var express = require('express'); // 설치한 express module을 불러와서 변수(express)에 담습니다.
var session = require('express-session');
var path = require("path");
var filters = require('pug-filters');
var bodyParser = require('body-parser');
var controller = require("./controller");

var app = express(); //express를 실행하여 app object를 초기화 합니다.
var port = process.env.PORT || 8000
app.set("port", process.env.PORT || 8000);
app.set("views", __dirname + "/views");
app.set("view engine", "pug");
app.use( bodyParser.json() );       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
}));
var log = console.log


app.use(express.static(path.join(__dirname, "public")));
app.use(express.static(path.join(__dirname, "node_modules/bootstrap-datepicker/dist")));

app.use(session({
 secret: '==%%%%$ECR3TK#Y*@#!==',
 resave: false,
 saveUninitialized: true
}));
app.use(function(req,res,next){
    res.locals.session = req.session;
    res.locals.timeformat = {
      hhmm: controller.timeformat.hhmm,
      mmss: controller.timeformat.mmss,
      yyyymmdd: controller.timeformat.yyyymmdd,
    }
    next();
});


app.use((req,res,next)=>{
  log(req.method, "] url:", req.url,",params:",req.body || req.query,", session:",req.session.logged);
  var sess = req.session;
  sess?sess:sess.logged={logged:false}
  if(req.session.logged || req.url.startsWith("/auth") || req.url == "/" || req.url == "/contact"){
    // next();
  controller.users.find(sess.userid,
    function(user) {
      sess.mileage = user.mileage || 0
      next();
    }, next);
  } else {
    res.redirect("/");
  }
});

app.post('/auth/signup', function(req, res) {
  var data = req.body
  controller.signup(data,
    function(data){
      res.redirect('/auth/login')
    },
    function(data){
      res.redirect('/auth/signup?err='+data)
    });
});

app.post('/auth', function(req, res) {
  var id = req.body.userid;
  var pw = req.body.userpw;
  controller.login(id,pw,
    function(data){
      var sess = req.session;
      sess.logged = true;
      sess.userid = id;
      sess.mileage = 0;
      sess.level = (id=='admin')?9000:1000; 
      res.redirect("/")
    },
    function(data){
      res.redirect("/auth/login?err="+data)
    });
});

app.post("/auth/anonymous", function(req, res) {
    hashCode = function(s) {
      var h = 0, l = s.length, i = 0;
      if ( l > 0 )
        while (i < l)
          h = (h << 5) - h + s.charCodeAt(i++) | 0;
      return h;
    };
    var sess = req.session;
    sess.logged = true;
    sess.userid = 'anonymous'+hashCode(new Date());
    sess.mileage = 0;
    sess.level = 1; 
    res.redirect("/")
});

app.get('/auth/logout', function(req, res) {
  var sess = req.session
  sess.id = null;
  sess.level = null;
  sess.mileage = 0;
  sess.logged = false;
  res.redirect("/auth/login")
})

app.get("/", function(req, res) {
  res.render("index");
});

app.get("/auth/login", function(req, res) {
    res.render("login", {
        title: "로그인"
    });
});

app.get("/auth/signup-agree", function(req, res) {
    res.render("signup-agree", {
        title: "회원가입"
    });
});

app.get("/auth/signup", function(req, res) {
    res.render("signup", {
        title: "회원가입",
        error: req.query.err
    });
});

app.get("/auth/forgot-password", function(req, res) {
    res.render("forget-password", {
        title: "비밀번호 찾기"
    });
});


//-------- Contect
app.get("/contact", function(req, res) {
    res.render("contact", {
        title: "찾아가기"
    });
});
//-------- Reservation
app.post("/laundry/reserve", function(req, res) {
  // var datetime = new Date(req.body.date +" "+req.body.time)
  x = req.body.date.split('-')
  y = req.body.time.split(':')
  datetime = new Date(req.body.date +" "+req.body.time)
  
  controller.reserve.add(req.session.userid, req.body.machineid, datetime,
    function(data){
      console.log("SUCC", data, req.body)
              controller.users.find(req.session.userid, function(uu) {
                fee = req.body.size=="large"?3000:2000
                // console.log(uu.mileage)
                // console.log(fee)
                // console.log(uu.mileage - (fee<uu.mileage ? fee : uu.mileage))
                m = uu.mileage
                if ( req.body.usemileage ) {
                  m -= fee<uu.mileage ? fee : uu.mileage
                } else {
                  m += req.body.size=="large"?30:20
                }
                controller.users.setMileage(req.session.userid, m,
                  function(){}, function(){})
              }, function(){})
      res.redirect("/laundry")
    },
    function(data){
      // console.log("FAIL", data)
      res.redirect("/laundry")
    }
  );
});

//-------- Payment
app.post("/laundry/payment", function(req, res) {
  x = req.body.date.split('-')
  y = req.body.time.split(':')
  datetime = new Date(x[0], x[1]-1, x[2], y[0], y[1])
  var date = req.body.date;
  var time = req.body.time;
  var number = req.body.number;
  var duration = 20;
  var start_date = new Date(date + " " + time);
  
  controller.machine.find(req.body.machineid,
    function(data) {
      // console.log(data)
      isLarge = data[0].size=="large"
      duration = isLarge ? 30 : 20;
      param = {
            title: "결제",
            number: data[0].number,
            machineid: req.body.machineid,
            date: date,
            time: time,
            duration: duration,
            start_date: start_date,
            end_date: new Date(start_date.getTime() + duration*60000),
            size: data[0].size,
            mileage: req.session.mileage || 0,
            fee: isLarge ? 3000 : 2000
          }
      if(req.session.level>=1000) {
        controller.users.find(req.session.userid, 
          function(user) {
            // console.log(user)
            res.render("payment", param);
          },
          
          function(user) {
              res.render("payment", {
                title: "결제 실패"
              });
            })
      }
      if(req.session.level==1) {
        // console.log("anonymous")
        res.render("payment", param);
      }

    },
    function(data) {
        res.render("payment", {
          title: "결제 실패"
        });
      }
    )

/*
  controller.reserve.add(req.session.userid, req.body.machineid, datetime,
  function(data){
    res.redirect("/laundry")
  },
  function(data){
    res.redirect("/laundry")
  });
*/
});

app.get("/laundry", function(req, res) {
  var rtn = {title: '예약'};
  date = new Date()
  rtn.date = req.query.date?req.query.date:(date.getFullYear()+"-"+(date.getMonth()+1)+"-"+date.getDate());
  rtn.time = req.query.time?req.query.time:((date.getHours()<10?"0"+date.getHours():date.getHours())+":"+(date.getMinutes()<10?"0"+date.getMinutes():date.getMinutes()));

  if(req.query.date && req.query.time) {
    x = req.query.date.split('-')
    y = req.query.time.split(':')
    datetime = new Date(x[0], x[1]-1, x[2], y[0], y[1])
  } else {
    datetime = new Date();
  }

  controller.machine.listByTime(
    datetime,
    function(data) {
      rtn.washers = data.filter(function(x){return x.type=='wash'})
      rtn.dryers = data.filter(function(x){return x.type=='dryer'})
      res.render("laundry", rtn)
    },
    function(data) {
      rtn.error = data;
      res.render("laundry", rtn)
    }
  )
});

app.get("/laundry-check", function(req, res) {
  var rtn = {title: '예약확인'};
  controller.reserve.listByUserId(
    req.session.userid,
    function(data) {
      rtn.list = data
        .filter(function(x){return x.to > new Date()})
        .sort(function(a,b){return a.from>b.from})
        .map(function(x){
          now = new Date()
          x.remainTime = 0
          if(x.canceled) {
            x.status = 'canceled'
          } else if(x.to < now) {
            x.status = 'finish'
          } else if (x.from <= now && now <= x.to) {
            x.status = 'using'
            x.remainTime = x.to - now
          } else {
            x.status = 'wait'
          }
          return x
        })
      res.render("laundry_check", rtn)
    },
    function(data) {
      rtn.error = data
      res.render("laundry_check", rtn)
    }
  )
});

app.get("/laundry-cancel", function(req, res) {
  console.debug(req.query )
  controller.reserve.cancelReserve(req.query.rid,
    function(data) {
      res.redirect("/laundry-check?canceled=succ")
    },
    function(data) {
      res.redirect("/laundry-check")
    })
});

//-------- Admin
app.get("/admin/waitings", function(req, res) {
  var rtn = {title: '예약 현황'};
  controller.reserve.list(
    function(data) {
      now = new Date()
      rtn.list = data
                  .filter(function(x){return x.to > new Date()})
                  .sort(function(a,b){return a.from>b.from})
                  .map(function(x){
                    x.remainTime = 0
                    if(x.canceled) {
                      x.status = 'canceled'
                    } else if(x.to < now) {
                      x.status = 'finish'
                    } else if (x.from <= now && now <= x.to) {
                      x.status = 'using'
                      x.remainTime = x.to - now
                    } else {
                      x.status = 'wait'
                    }
                    return x
                  })
      res.render("admin/waitings", rtn)
    },
    function(data) {
      rtn.error = data
      res.render("admin/waitings", rtn)
    }
  )
});

app.get(["/admin", "/admin/machines"], function(req, res, next) {
  var rtn = {title: '머신 관리'};
  controller.machine.list(
    function(data) {
      rtn.washers = data.filter(function(x){return x.type=='wash'})
      rtn.dryers = data.filter(function(x){return x.type=='dryer'})
      res.render("admin/machine", rtn)
    },
    function(data) {
      rtn.error = data;
      res.render("admin/machine", rtn)
    }
  )
});

app.post("/machine/dryer", function(req, res) {
  controller.machine.add("dryer", req.body.size,
    function(data){
      res.redirect("/admin/machines")
    },
    function(data){
      res.redirect("/admin/machines")
    });
});
app.post("/machine/wash", function(req, res) {
  controller.machine.add("wash", req.body.size,
    function(data){
      res.redirect("/admin/machines")
    },
    function(data){
      res.redirect("/admin/machines")
    });
});

app.post("/machine/broken", function(req, res) {
  var machineid = req.body.machineid;
  var broken = req.body.broken;
  controller.machine.broken(
    machineid, broken,
    function(data) {
      res.redirect("/admin/machines")
    },
    function(data) {
      res.redirect("/admin/machines")
    })
})

app.post("/machine/delete", function(req, res) {
  var machineid = req.body.machineid;
  if(!req.body.delete) res.redirect("/admin/machines")
  controller.machine.delete(
    machineid,
    function(err) {
      console.log(err)
      res.redirect("/admin/machines")
    },
    function(num) {
      console.log(num+" deleted.")
      res.redirect("/admin/machines")
    })
})

app.listen(port, function(){ //3000번 포트를 사용합니다.
  console.log('Server start: http://localhost:'+port); //서버가 실행되면 콘솔창에 표시될 메세지입니다.
});