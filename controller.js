var Datastore = require('nedb')
var userdb = new Datastore({ filename: 'data/users', autoload: true });
var machinedb = new Datastore({ filename: 'data/machines', autoload: true });
var reservedb = new Datastore({ filename: 'data/reserves', autoload: true });
var paymentdb = new Datastore({ filename: 'data/payment', autoload: true });


userdb.ensureIndex({ fieldName: 'userid', unique: true }, function (err) {
  if(err) log("ERROR: Index error."+err)
});

exports.log = log = console.log;

// Utils
function timeformat_hhmm(t) {
  d = new Date(t)
  hh = ("0000"+d.getHours()).substr(-2,2)
  mm = ("0000"+d.getMinutes()).substr(-2,2)
  return (t<0?'-':'')+hh+" : "+mm
}
function timeformat_mmss(t) {
  d = new Date(t)
  mm = ("0000"+d.getMinutes()).substr(-2,2)
  ss = ("0000"+d.getSeconds()).substr(-2,2)
  return (t<0?'-':'')+mm+" : "+ss
}
function timeformat_yyyymmdd(t) {
  d = new Date(t)
  return d.getFullYear()+"."+(d.getMonth()+1)+"."+d.getDate()
}

//-----------------------------------------------------------------------------
// Auth
function login(id, pw, succ, fail) {
  userdb.find({userid:id, userpw:pw}, function (err, docs) {
    if(err || docs.length!=1) fail(err);
    else succ(docs);
  });
}

function signup(data, succ, fail) {
  data._id = data.id
  userdb.insert(data, function(err, docs) {
    if(err) fail(err);
    else succ(docs);
  })
}

function findUser(id, succ, fail) {
  userdb.find({userid:id}, function(err, docs) {
    if(err || docs.length!=1) fail(err);
    else succ(docs[0])
  });
}

function setMileage(id, mileage, succ, fail) {
   userdb.update({userid:id}, {$set:{mileage: mileage}}, {upsert: true}, function(err, docs) {
      console.log(id, mileage)
      if(err) fail(err)
      else succ(docs)
  }); 
}

//-----------------------------------------------------------------------------
// Machine
function addMachine(type, size, succ, fail) {
  date = Date.now()
  id = date*Math.random()
  if(!size) size = 'small'
  machinedb.count({}, function(err, count) {
    machinedb.insert({type: type, size:size, number:count+1}, function(err, docs) {
      if(err) fail(err);
      else succ(docs);
    })
  })
}

function deleteMachine(machineid, succ, fail) {
  machinedb.remove({_id: machineid}, {}, function(err, num) {
    if(err) fail(err);
    else {
      console.log("m-del"+num)
      reservedb.remove({machineid: machineid}, {}, function(err, num) {
        if(err) fail(err);
        else {
          console.log("r-del"+num)
          succ(num);
        }
      });
    }
  })
}

function getMachineByDate(date, succ, fail) {
  machinedb.find({}, function(err, docs) {
    if(err) fail(err);
    else {
      data = {}
      docs.forEach(function(x) { data[x._id] = x; data[x._id].able = true })
      reservedb.find({}, function(err, docs) {
        if(err) fail(err);
        else {
          var able = true;
          docs.forEach(function(x){
            if(data[x.machineid]==undefined){return;}
            var duration = data[x.machineid]['size']=='large'?30:20
            var to = date.getTime() + 60000*(duration)
            isusing = Math.max(Math.min(x.to.getTime(), to) - Math.max(x.from.getTime(), date), 0) > 0
            data[x.machineid].from = x.from
            data[x.machineid].to = x.to
            console.log(x)
            if(x.canceled) {
              data[x.machineid].able = true
            } else if(isusing) {
              data[x.machineid].able = false
              data[x.machineid].remaintime = x.to - new Date()
            }
          })
          succ(Object.values(data))
        }
      })
    }
  });
}

function getAllMachine(succ, fail) {
  getMachineByDate(new Date(), succ, fail)
}

function getMachineById(machineid, succ, fail) {
  machinedb.find({_id: machineid}, function(err, docs){
    if(err) fail(err);
    else if( docs.length<=0) fail("not found machinedid: ", machineid)
    else succ(docs)
  })
}

function setMachineBroken(machineid, isbroken, succ, fail) {
  machinedb.update({_id: machineid}, {$set :{broken: isbroken}}, {upsert: true}, function(err, num) {
    if(err) fail(err);
    else succ(num)
  })
}
//-----------------------------------------------------------------------------
// Reservation
function addReserve(userid, machineid, from, succ, fail) {
  getMachineById(machineid,
    function(machine) {
      var to = from.getTime() + 60000*(machine['size']=='large'?30:20)
      reservedb.find({machineid: machineid}, function(err, docs) {
        if(err) fail(err);
        else {
          // check time
          var able = true;
          docs.forEach(function(x){ 
            able &= !Math.max(Math.min(x.to.getTime(), to) - Math.max(x.from.getTime(), from), 0);
          })
          if(!able) {
            fail({error: '예약할 수 없습니다.'})
            return;
          }
          reservedb.insert({machineid: machineid, from:from, to:new Date(to), userid: userid }, function(err, docs) {
            if(err) fail(err);
            else {
              succ(docs)
            }
          })
        }
      })
  }, fail)
}

function getReserveByUserId(userid, succ, fail) {
  reservedb.find({userid: userid}, function(err, docs) {
    if(err) fail(err);
    else succ(docs)
  })
}

function cancelReserve(reserveid, succ, fail) {
  reservedb.update({_id:reserveid}, {$set:{canceled: true}}, {upsert: true}, function(err, docs) {
    if(err) fail(err)
    else succ(docs)
  }); 
}


function allReserve(succ, fail) {
    reservedb.find({}, function (err, docs) {
    if(err) fail(err);
    else {
      succ(docs);
    }
  });
}


exports.login = login;
exports.signup = signup;

exports.users = {
  find: findUser,
  setMileage: setMileage
}
exports.machine = {
  add: addMachine,
  delete: deleteMachine,
  find: getMachineById,
  listByTime: getMachineByDate,
  list: getAllMachine,
  broken: setMachineBroken
}
exports.reserve = {
  add: addReserve,
  list: allReserve,
  cancelReserve: cancelReserve,
  listByUserId: getReserveByUserId
}
exports.timeformat = {
  mmss: timeformat_mmss,
  hhmm: timeformat_hhmm,
  yyyymmdd: timeformat_yyyymmdd
}