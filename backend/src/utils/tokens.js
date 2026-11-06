const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const env = require('../config/env');

function signAccessToken(userId) {
  return jwt.sign({ sub: userId, typ: 'access' }, env.accessSecret, {
    expiresIn: env.accessTtl,
    issuer: 'thaja-suddi',
  });
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.accessSecret, { issuer: 'thaja-suddi' });
}

function randomToken(bytes = 48) {
  return crypto.randomBytes(bytes).toString('hex');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function hashVisitor(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 40);
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
  randomToken,
  hashToken,
  hashVisitor,
};
