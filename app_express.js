// 引入依赖
var express = require('express');
var superagent = require('superagent');
var cheerio = require('cheerio');
//异步
var async = require('async');
//日期
var moment = require('moment');
//日志
var log4js = require("log4js");
log4js.configure({
  appenders: [{
    type: 'console'
  }, {
    type: 'dateFile',
    filename: process.env.LOG_URL+'/docker',
    pattern: "yyyyMMdd.log",
    alwaysIncludePattern: true,
    category: 'log4jslog'
  }],
  replaceConsole: true
});
var logger = log4js.getLogger('log4jslog');

// 内置
var url = require('url');

var cnodeUrl = 'https://cnodejs.org/';

// 建立 express 实例
var app = express();

app.use(log4js.connectLogger(logger, {
  level: 'info'
}));

app.listen(3000, function(req, res) {
  logger.info('app is running at port 3000');
});

app.get('/', function(req, res, next) {
  // 用 superagent 去抓取 https://cnodejs.org/ 的内容
  superagent.get(cnodeUrl)
    .end(function(err, sres) {
      // 常规的错误处理
      if (err) {
        return next(err);
      }
      //截图
      //capture(cnodeUrl);

      // sres.text 里面存储着网页的 html 内容，将它传给 cheerio.load 之后
      // 就可以得到一个实现了 jquery 接口的变量，我们习惯性地将它命名为 `$`
      // 剩下就都是 jquery 的内容了
      var $ = cheerio.load(sres.text);
      var items = [];
      var topicUrls = [];

      items.push({
        title: process.env.LOG_URL,
        href: process.env.LOG_URL
      });
      $('#topic_list .topic_title').each(function(idx, element) {
        var $element = $(element);
        items.push({
          title: $element.attr('title'),
          href: $element.attr('href')
        });
        // 获取链接地址
        var href = url.resolve(cnodeUrl, $element.attr('href'));
        topicUrls.push(href);
      });

      var concurrencyCount = 0;
      var fetchUrl = function(href, callback) {
        concurrencyCount++;
        logger.info('现在的并发数是', concurrencyCount, '，正在抓取的是', href);
        superagent.get(href)
          .end(function(err, res) {
            logger.info('访问 ' + href + ' successful');
            //console.log(res.text);
            var $ = cheerio.load(res.text);
            // console.log('title', $('.topic_full_title').text().trim(), 'comment1', $('.reply_content').eq(0).text().trim()); 
            logger.info('结果：', {
              title: $('.topic_full_title').text().trim(),
              href: href,
              comment1: $('.reply_content').eq(0).text().trim(),
            });
            concurrencyCount--;
            callback(null, href + ' OK');
          });

      };

      async.mapLimit(topicUrls, 5, function(url, callback) {
        fetchUrl(url, callback);
      }, function(err, result) {
        logger.info('final:');
        logger.info(result);
      });

      res.send(items);
    });
});