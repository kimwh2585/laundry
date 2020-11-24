function timer(div, tt) {
    if(tt!==undefined) {
    } else {
        t = $(div).text().split(":")
        tt = Number(t[0])*60 + Number(t[1])
    }

    if(tt!=tt || tt<0){
        return
    }
    hh = ("0000"+Math.floor(tt/60)).substr(-2,2)
    mm = ("0000"+tt%60).substr(-2,2)
    $(div).text(hh+" : "+mm)

    setTimeout(function(){ timer(div, tt-1) }, 1000); // 3000ms(3초)가 경과하면 ozit_timer_test() 함수를 실행합니다.
}



$(".dropdown-menu").on('click', 'li a', function(){
    p = $(this).closest(".machine");
    id = p.data("washer");
    v = $(this).attr("value");
    p.find("button").text($(this).text());

    if(v!=2) {
        p.find(".timer").text("-- : --");
    } else {
        // TODO: 시간 넣기
        p.find(".timer").text("00 : 05");
        timer(p.find(".timer"));
    }
});

$(".timer").each(function(i, o){timer(o)});
$("li.nav-item").each(function(i, o){
    url = window.location.href.replace(window.location.origin,"")
    if($(o).find("a.nav-link").attr("href")==url) {
        $(o).addClass("active")
    }
})
