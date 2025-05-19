"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Priority = void 0;
var Priority;
(function (Priority) {
    Priority[Priority["immediate"] = 10] = "immediate";
    Priority[Priority["throttled"] = 5] = "throttled";
    Priority[Priority["low"] = 1] = "low";
})(Priority || (exports.Priority = Priority = {}));
