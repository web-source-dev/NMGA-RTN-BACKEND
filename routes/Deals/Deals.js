const express = require('express');
const router = express.Router();

router.use('/create', require('./CreateDeals'));
router.use('/fetch', require('./FetchDeals'));
router.use('/fetch-single', require('./FetchSingleDeal'));
router.use('/update', require('./UpdateDeal'));
router.use('/update-status', require('./UpdateDealStatus'));
router.use('/delete', require('./DeleteDeal'));
router.use('/fetchAll', require('./fetchAllDeals'));
router.use('/favorite', require('./Favourite'));
router.use('/commit', require('./Commitments'));
router.use('/get', require('./recentCommit'));
router.use('/bulk', require('./BulkUpload'));
router.use('/order', require('./Order'));
router.use('/default', require('./DefualtPage'));
router.use('/singleCommitment/deal',require('./SingleDealCommitments'))


module.exports = router;
