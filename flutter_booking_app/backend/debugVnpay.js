const crypto = require('crypto');
function buildVnpayQuery(params, secretKey) {
  const data = { ...params };
  delete data.vnp_SecureHash;
  delete data.vnp_SecureHashType;
  const sortedKeys = Object.keys(data).sort();
  const rawData = sortedKeys
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(data[key])}`)
    .join('&');
  const secureHash = crypto.createHmac('sha512', secretKey).update(rawData).digest('hex');
  const query = sortedKeys
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(data[key])}`)
    .join('&');
  return { rawData, secureHash, query };
}
const params = {
  vnp_Version: '2.1.0',
  vnp_Command: 'pay',
  vnp_TmnCode: 'T6NGVHQX',
  vnp_Amount: '100000',
  vnp_CurrCode: 'VND',
  vnp_TxnRef: 'SHOP-1-1234567890',
  vnp_OrderInfo: 'Thanh toán đơn hàng #1',
  vnp_OrderType: 'other',
  vnp_Locale: 'vn',
  vnp_ReturnUrl: 'https://declared-afternoon-magazine.ngrok-free.dev/api/shop/vnpay/return',
  vnp_CreateDate: '20260509120000',
  vnp_IpAddr: '127.0.0.1',
  vnp_SecureHashType: 'SHA512',
};
const secret = 'K2QO8601YBCKL93WP3GJ33M0JYYEMCOY';
const out = buildVnpayQuery(params, secret);
console.log('rawData:', out.rawData);
console.log('secureHash:', out.secureHash);
console.log('query:', out.query);
console.log('full:', out.query + '&vnp_SecureHashType=SHA512&vnp_SecureHash=' + out.secureHash);
