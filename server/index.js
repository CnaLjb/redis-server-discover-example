var fs = require("fs")
var http = require('http');
var redis  = require('redis');
var request = require('request');
var moment = require("moment");
var schedule = require("node-schedule")

/**
 *   服务
 */
class Server{

    constructor(ip,servName,port){
        this.name = servName
        this.server = null;
        this.redisCli = null;
        this.ip = ip;
        this.port = port
        this.init();
    }

    init(){
        this.initConfig()
        this.initRedisCli()
        this.initHttpServer();
    }

    initConfig(){
        this.config = JSON.parse(fs.readFileSync("../config/config.json").toString())
    }

    serverHandler(req,res){
        res.end(`server- ${this.name} ip is ${this.ip} and port is ${this.port}.`);
    }

    initHttpServer(){
        this.server = http.createServer(this.serverHandler.bind(this)).listen(this.port);
    }

    initRedisCli(){
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
            console.log("连接redis服务器成功...")
            // 注册服务
            client.zadd(self.name,self.getdeadline(),self.ip+":"+self.port,function(err,reply){
                if(!err){
                    // 成功
                    client.publish("ServerNotify",JSON.stringify({'servName':self.name}))
                    self.heartbeat();
                }
            })
        });

        this.redisCli = client;
    }

    /**
     * 心跳  8s一次
     */
    heartbeat(){
        var self = this;
        schedule.scheduleJob('*/8 * * * * *', function(){
            console.log("---------server定时发送心跳包给redis注册中心-------------")
            self.redisCli.zadd(self.name,self.getdeadline(),self.ip+":"+self.port);
        })
    }

    /**
     *  获取有效期
     */
    getdeadline(){
        return moment().unix() + 10;
    }
}


new Server("127.0.0.1",process.argv[2],process.argv[3]||3000)