"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StockMovementType = exports.UserRole = exports.OrderStatus = void 0;
// Енумы
var OrderStatus;
(function (OrderStatus) {
    OrderStatus["NEW"] = "NEW";
    OrderStatus["WAITING_PAYMENT"] = "WAITING_PAYMENT";
    OrderStatus["PREPARING"] = "PREPARING";
    OrderStatus["DELIVERING"] = "DELIVERING";
    OrderStatus["DELIVERED"] = "DELIVERED";
    OrderStatus["CANCELLED"] = "CANCELLED";
})(OrderStatus || (exports.OrderStatus = OrderStatus = {}));
var UserRole;
(function (UserRole) {
    UserRole["ADMIN"] = "ADMIN";
    UserRole["CUSTOMER"] = "CUSTOMER";
    UserRole["COURIER"] = "COURIER";
    UserRole["SELLER"] = "SELLER";
})(UserRole || (exports.UserRole = UserRole = {}));
var StockMovementType;
(function (StockMovementType) {
    StockMovementType["INCOME"] = "INCOME";
    StockMovementType["OUTCOME"] = "OUTCOME";
})(StockMovementType || (exports.StockMovementType = StockMovementType = {}));
