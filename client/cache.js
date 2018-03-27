var redis  = require('redis');
var fs = require("fs")
var _ = require("underscore");
var schedule = require("node-schedule")

class Cache{

    constructor(){
        this.cli = null;
        this.cache = {}
        this.initCli()
    }

    initCli(){
        var self = this;
        var config = JSON.parse(fs.readFileSync("../config/config.json").toString())
        var ip = config.center.ip;
        var port = config.center.port;
        var client  = redis.createClient(port,ip);
        client.auth(config.center.auth,function(){
            self.heartbeat()
        });
        this.cli = client;
    }

    updateCache(servName){
        var self = this;
        // 显示整个有序集成员
        this.cli.ZRANGE(servName,0,-1,"WITHSCORES",function(err,reply){
            if(!err){
                console.log("更新 %s",servName)
                var servData = self.cache[servName];
                if (!servData) {
                    servData = self.cache[servName] = {}
                }
                if(Array.isArray(reply) && reply.length>0 && reply.length%2==0){
                    for(var i=0;i<reply.length;i++){
                        if(i%2==1){
                            servData[reply[i-1]] = parseFloat(reply[i])
                        }
                    }
                    console.log("servData:%s",JSON.stringify(servData));
                }
            }
        })
    }

    heartbeat(){
        var self = this;
        // 10s 执行一次
        schedule.scheduleJob('*/10 * * * * *', function(){
            console.log("*******************cache定时执行heartbeat**************")
            var servArr = _.keys(self.cache);
            servArr.forEach(function(item){
                self.updateCache(item)
            })
        });
    }

    getServMap(servName){
        return this.cache[servName]
    }
}

module.exports = Cache