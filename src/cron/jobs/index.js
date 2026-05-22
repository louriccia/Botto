// Registers every cron job with the scheduler. Each job module calls
// scheduler.register({name, schedule, run}) at require-time.
//
// Keeping this as a single import point means src/bot.js only needs one
// require('./cron/jobs') — new jobs show up here, not in bot.js.

require('./syncSpeedgaming');
require('./tourneyBet48h');
require('./liveMatchSetup');
require('./streamNotification');
require('./closeMatchBets');
require('./liveMatchRoleCleanup');
