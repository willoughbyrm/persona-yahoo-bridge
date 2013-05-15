/* this Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const config = require('./configuration'),
logger = require('./logging').logger,
Sekrit = require('./sekrit'),
session = require('./session_context');

var sekrit = new Sekrit({});

/**
 * Validates user session and creates secret PIN
 * for verifying accounts.
 *
 * cb is function(err, pin)
 */
exports.generateSecret = function(req, res, cb) {
  var claim = session.getClaimedEmail(req);

  if (!claim) {
    return cb(new Error("Session is missing claimed email"));
  }
  sekrit.createPinCode(claim, function(err, pinCode) {
    if (! req.pincodedb)
      throw new Error("Invalid state, missing pin code db cookie");

    if (! req.pincodedb) {
      req.pincodedb = {};
    }

    // Remember User's PIN for later verification
    // We have no backend database.
    req.pincodedb.expected_pin = pinCode;

    if (err) {
      cb(err);
    } else {
      cb(null, claim, pinCode);
    }
  });
};

/**
 * cb is function(err, pinCodeValid)
 * pinCodeValid is a boolean
 */
exports.validateSecret = function(req, res, cb) {
  // Issue #218 Take extra time to validate PIN
  setTimeout(function() {
    if (!req.pincodedb) {
      return cb(new Error("Invalid state, missing pin code db cookie"));
    }
    var expectedPin = req.pincodedb.expected_pin;
    if (! req.body || ! req.body.pin) {
      return cb(new Error("Invalid request"));
    }
    return cb(null, expectedPin === req.body.pin);
  }, 2000);
};

/*
 * Records a successful PIN verification against an email address
 */
exports.markVerified = function(claimEmail, req) {
  var cEmail = claimEmail.toLowerCase();
  if (!req.pincodedb.verified) {
    req.pincodedb.verified = {};
  }
  req.pincodedb.verified[claimEmail] = true;
};

/*
 * Checks user's pin code cookie for a successful PIN verification
 * on a claimed identity. This will be usable for
 * `pin_code_sessions.duration` milliseconds (10 minutes for example)
 */
exports.wasValidated = function(claimEmail, req) {
  var cEmail = claimEmail.toLowerCase();

  if (req.pincodedb && req.pincodedb.verified) {
    return req.pincodedb.verified[claimEmail];
  }
  return false;
};

exports.getAllLinks = function(req) {
  var links = [];

  if (req.accountdb && req.accountdb.links) {
    try {
      links = JSON.parse(req.accountdb.links);
    } catch (e) { return false; }
  }
  return links;
};
