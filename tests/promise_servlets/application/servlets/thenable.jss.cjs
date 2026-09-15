exports.servlet=function () {
    return {
        then:function (resolve) {
            queueMicrotask(function () { resolve("thenable hello"); });
        }
    };
};
