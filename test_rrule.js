const { RRule, rrulestr } = require('rrule');

const startDate = new Date();
const rrule = new RRule({ freq: RRule.DAILY, dtstart: startDate });
const rruleString = rrule.toString();

console.log("String:", rruleString);

try {
    const options = RRule.parseString(rruleString);
    console.log("Parsed Options:", options);
} catch (e) {
    console.error("parseString Error:", e.message);
}

try {
    const rule2 = rrulestr(rruleString);
    console.log("rrulestr:", rule2.options);
} catch (e) {
    console.error("rrulestr Error:", e.message);
}
