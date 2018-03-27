var redis  = require('redis');
var request = require('request');
var http = require('http');
var _  = require("underscore")
var url=require("url");  
var querystring=require("querystring");
var util = require("util")
var fs = require("fs")
var myCache = require("./cache.js")
var moment = require("moment");

class Client{

    constructor(){
        this.cache = new myCache();
        this.init()
    }

    init(){
        this.initConfig()
        this.initEnter()
        this.initCli()
        console.log("初始化完成...")
    }

    initConfig(){
        this.config = JSON.parse(fs.readFileSync("../config/config.json").toString())
    }    

    serverHandler(req,res){
        var arg = querystring.parse(url.parse(req.url).query);
        if(arg && arg.serverName){
            var name = arg.serverName;
            var sMap = this.cache.getServMap(name)
            if(sMap){
                var slist = _.keys(sMap)
                var address = slist[_.random(0,slist.length-1)]
                var now = moment().unix();
                console.log("now:%d, deadline:%d",now,sMap[address]);
                if(sMap[address] < now){
                    // 过期了
                    delete sMap[address]
                    res.end(`service overdue !!!`);
                    return
                }
                console.log("address:%s",address);
                // 访问获取内容
                request(util.format("http://%s",address), function (error, response, body) {
                    if (!error && response.statusCode == 200) {
                        res.end(body);
                    }else{
                        // console.log(err)
                        res.end("service error");
                    }
                })
            }else{
                res.end(`no service`);    
            }
        }else{
            res.end(`no service`);
        }
    }

    initEnter(){
        this.server = http.createServer(this.serverHandler.bind(this)).listen(4000);
    }

    initCli(){
        var self = this;
        var ip = this.config.center.ip;
        var port = this.config.center.port;
        var client  = redis.createClient(port,ip);
        client.auth(this.config.center.auth);
        
        client.on("error", function(error) {
            console.log("连接redis服务器异常...",error);
            process.exit(1);
        });

        client.on('connect', function () {
            // 订阅weacher的channel
            client.subscribe("ServerNotify");
        });

        client.on("message", function (channel, message) {
            console.log("普通订阅接收到来自" + channel + "的信息:" + message);
            if(channel == "ServerNotify"){
                // 更新缓存
                self.cache.updateCache(JSON.parse(message).servName)
            }
        });

        this.redisCli = client;
    }
}


new Client();