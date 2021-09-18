$('#imageholder img').on('mousemove', null, [$('#horizontal'), $('#vertical')],function(e){
    e.data[1].css('left', e.offsetX==undefined?e.originalEvent.layerX:e.offsetX);
    e.data[0].css('top', e.offsetY==undefined?e.originalEvent.layerY:e.offsetY);
});
$('#imageholder').on('mouseenter', null, [$('#horizontal'), $('#vertical')], function(e){
    e.data[0].show();
    e.data[1].show();
}).on('mouseleave', null, [$('#horizontal'), $('#vertical')], function(e){
        e.data[0].hide();
        e.data[1].hide();
});