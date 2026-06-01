"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createD1Database = createD1Database;
const d1_1 = require("drizzle-orm/d1");
const schema_1 = require("./schema");
function createD1Database(client) {
    return (0, d1_1.drizzle)(client, { schema: schema_1.dbSchema });
}
