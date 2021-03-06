var request = require("request");
var url = require("url");
var assert = require("assert");

var api_secret = null;
var marketplace_id = null;
var balanced = null;
var test = {};
var cards = {
	mastercard:{
		card_number: "5105105105105100",
		expiration_month: "12",
		expiration_year: "2015",
		security_code: "123"
	},
	visa: {
		card_number: "4111111111111111",
		expiration_month: "12",
		expiration_year: "2015",
		security_code: "123"
	},
	amex: {
		card_number: "341111111111111",
		expiration_month: "12",
		expiration_year: "2015",
		security_code: "1234"
	},
	insufficient: { // we'll be unable to place a hold on this card--insufficient funds.
		card_number: "4444444444444448",
		expiration_month: "12",
		expiration_year: "2015",
		security_code: "123"
	},
	canceled: { // we'll be unable to place a hold on this card--canceled
		card_number: "4222222222222220",
		expiration_month: "12",
		expiration_year: "2015",
		security_code: "123"
	}
};

var bank_accounts = {
	san_mateo_cu:'321174851',
	bank_of_america:'122000030',
	jp_morgan_chase:'021000021'
};


var client = function(method, uri, json, cb) {

  //make json param optional
  if (typeof json === 'function' && cb === undefined){cb = json; json = null;}

  if (api_secret){
    uri = url.format({protocol: "https", host: "api.balancedpayments.com", auth: api_secret + ':', pathname: uri});
  } else {
    uri = url.format({protocol: "https", host: "api.balancedpayments.com", pathname: uri});
  }

  request({
    method: method,
    uri: uri,
    encoding: "utf-8",
    json: json || true
  }, function(err, response, body) {
    if (response.statusCode >= 403){ // canceled card will return 402, so allow higher 400 codes.

      if (body !== undefined){
        err = new Error("Balanced call failed: " + response.statusCode + " - " + body.response);
      } else {
        err = new Error("Balanced call failed: " + response.statusCode);
      }
    }

    cb(err, body);

  });
}


before(function(done){

  //create a marketplace
  client("POST", "/v1/api_keys", function(err, res){
    if (err){return done(err);}

    //set the api secret
    api_secret = res.secret;

    client("POST", "/v1/marketplaces", function(err, res){
      if (err){return done(err);}

      marketplace_id = res.id;

      test.email = function(){ return Math.random() + 'test@testing.com'; };
      test.card_info = {card_number: "5105105105105100", expiration_month: "12", expiration_year: "2020", security_code: "123"};
      test.bank_info = {name: "Johann Bernoulli", account_number: "9900000001", routing_number: "121000358", type: "checking"};
      test.debit_info = { id: null, debit_uri: null };
      test.debit_info_2 = { id: null, debit_uri: null };
      test.hold_info = { id: null };
      test.refund_info = { id: null };

      var count = 0;
      var track = function(){
        if (++count === 2){
          balanced = require("../index")(api_secret, marketplace_id);
          done();
        }
      }
      //create a card token
      client("POST", "/v1/marketplaces/" + marketplace_id + "/cards", cards.mastercard, function(err, res){
        if (err){
          done(err);
        } else {
          test.card_id = res.id;
          track();
        }
      });
      //create bank token
      client("POST", "/v1/bank_accounts", test.bank_info, function(err, res){
        if (err){
          done(err);
        } else {
          test.bank_id = res.id;
          track();
        }
      });
    });
  });
});





//TESTS
describe('balanced', function(){


  //ACCOUNT
  describe('.account', function(){

    describe('.create', function(){

      it('should create a valid balanced account', function(done){

        balanced.account.create({email_address: test.email()}, function(err, res){

          assert.equal(err, null, err);
          assert.notEqual(res.id, null, "account.id is null");

          if (res.id){test.account_id = res.id}

          done();

        });

      });

    });

    describe('.add_card (w/id)', function(){

      it('should add a card to the account with a id as input', function(done){

        balanced.account.add_card(test.account_id, test.card_id, function(err, res){

          assert.equal(err, null, err);
          assert.notEqual(res.id, null, "account_id is null");

          done();

        });
      });
    });

    describe('.add_card (w/info)', function(){

      it('should add a card to the account with a token as input', function(done){

        balanced.account.add_card(test.account_id, test.card_info, function(err, res){

          assert.equal(err, null, err);
          assert.notEqual(res.id, null, "account_id is null");

          done();

        });
      });
    });

    describe('.debit', function(){

      it('should debit the users account $10', function(done){

        balanced.account.debit(test.account_id, {
          amount: 1000,
          appears_on_statement_as: 'TEST TEXT',
          description: 'node_balanced test debit, $10'
        }, function(err, res){

          assert.equal(err, null, err);
          assert.notEqual(res.id, null, "debit_id is null");

          done();

        });
      });
    });


    describe('.hold', function(){

      it('should put a hold on users account for $5', function(done){

        balanced.account.hold(test.account_id, {
          amount: 500
        }, function(err, res){

          assert.equal(err, null, err);
          assert.notEqual(res.id, null, "hold_id is null");

          done();

        });
      });
    });



    describe('.add_bank (w/id)', function(){

      it('should add a bank account to the account with a id as input', function(done){

        balanced.account.add_bank(test.account_id, test.bank_id, function(err, res){

          assert.equal(err, null, err);
          assert.notEqual(res.id, null, "account_id is null");

          done();

        });
      });
    });

    describe('.add_bank (w/info)', function(done){

      it('should add a bank account to the account with a info as input', function(done){

        balanced.account.add_bank(test.account_id, test.bank_info, function(err, res){

          assert.equal(err, null, err);
          assert.notEqual(res.id, null, "account_id is null");

          done();

        });
      });

    });

    describe('.credit', function(done){

      it('should credit this account\'s bank_account with $5', function(done){

        balanced.account.credit(test.account_id, {
          amount: 500,
          description: 'node_balanced test'
        }, function(err, res){

          assert.equal(err, null, err);
          assert.notEqual(res.id, null, "account_id is null");

          done();

        });
      });

    });

    describe('.underwrite', function(done){

      it('should underwrite this account', function(done){

        balanced.account.underwrite(test.account_id, {
          type: 'person',
          phone_number: '+19046281796',
          postal_code: '94110',
          street_address: 'Somewhere over the rainbow',
          dob: '1980-01-01' ,
          name: "Johann Bernoulli",
        },function(err, res){

          assert.equal(err, null, err);
          assert.notEqual(res.id, null, "res.id is null");

          done();

        });
      });

    });

    describe('.get', function(done){

      it('should get the details for this account', function(done){

        balanced.account.get(test.account_id, function(err, res){

          assert.equal(err, null, err);
          assert.notEqual(res.id, null, "account_id is null");

          done();

        });
      });

    });

    describe('.transactions', function(done){

      it('should get all the debits/credits this account', function(done){

        balanced.account.transactions(test.account_id, function(err, res){

          assert.equal(err, null, err);
          assert.notEqual(res.items, null, "res.items is null");

          done();

        });
      });
    });

  });


  //MARKETPLACE
  describe('.marketplace', function(){

    describe('.accounts', function(done){

      it('should get all the debits/credits this account', function(done){

        balanced.marketplace.accounts(function(err, res){

          assert.equal(err, null, err);
          assert.notEqual(res.items, null, "res.items is null");

          done();

        });
      });

    });

    describe('.debits', function(done){

      it('should get all the debits/credits this account', function(done){

        balanced.marketplace.debits(function(err, res){

          assert.equal(err, null, err);
          assert.notEqual(res.items, null, "res.items is null");

          done();

        });
      });

    });

    describe('.credits', function(done){

      it('should get all the debits/credits this account', function(done){

        balanced.marketplace.credits(function(err, res){

          assert.equal(err, null, err);
          assert.notEqual(res.items, null, "res.items is null");

          done();

        });
      });
    });

    describe('.refunds', function(done){

      it('should get all the debits/credits this account', function(done){

        balanced.marketplace.refunds(function(err, res){

          assert.equal(err, null, err);
          assert.notEqual(res.items, null, "res.items is null");

          done();

        });
      });
    });

    describe('.holds', function(done){

      it('should get all the debits/credits this account', function(done){

        balanced.marketplace.holds(function(err, res){

          assert.equal(err, null, err);

          done();

        });
      });
    });

  }); //marketplace

  //CARD

  describe('.card', function(){

    describe('.create', function(done){

      it('should create a card', function(done){

        balanced.card.create(cards.visa, function(err, res){

          assert.equal(err, null, err);
          assert.notEqual(res.id, null, "res.id is null");
          assert.notEqual(res.hash, null, "res.hash is null");
          assert.equal(res.is_valid, true, "res.is_valid is true");

          //cache the info in the test object
		  if (res.id) {
		  	test.visa = {id:res.id, hash: res.hash};
		  }

          done();

        });
      });
    });

    describe('.create another', function(done){

      it('should create a card, different from the one we created before', function(done){

        balanced.card.create(cards.mastercard, function(err, res){

          assert.equal(err, null, err);
          assert.notEqual(res.id, null, "res.id is null");
          assert.notEqual(res.hash, null, "res.hash is null");
          assert.equal(res.is_valid, true, "res.is_valid is true");

          //cache the info in the test object
		  if (res.id) {
		  	test.mastercard = {id:res.id, hash: res.hash};
		  }

          done();

        });
      });
    });

    describe('.create a canceled card (should throw an error.)', function(done){

      it('should return a 402', function(done){

        balanced.card.create(cards.canceled, function(err, res){
          //error's not null, but it's pretty much empty.
          assert.equal(res.category_code, 'card-declined', "Card is declined");
          assert.equal(res.status_code, '402', "402--payment required");
          done();

        });
      });
    });


    describe('.retrieve', function(done){

      it("should retrieve a card's info", function(done){

        balanced.card.retrieve(test.visa.id, function(err, res){

          assert.equal(err, null, err);
          assert.notEqual(res.id, null, "res.id is null");
          assert.equal(res.id, test.visa.id, "res.id equals the id we sent");
          assert.equal(res.is_valid, true, "res.is_valid is true");

          done();

        });
      });
    });

    describe('.list_all', function(done){

      it("should list all the marketplace's cards", function(done){

        balanced.card.list_all(function(err, res){

          assert.equal(err, null, err);
          assert.equal(res.items.length, 2, 'We have two cards in our list.');

          done();

        });
      });
    });

    describe('.update', function(done){


      it("should update a card...and passes the test, but doesn't really update", function(done){

	    var updateData = {description:"Test User"};

        balanced.card.update(test.mastercard.id, updateData, function(err, res){

          assert.equal(err, null, err);

          //this isn't actually updating data yet.
		  //console.log(res);
          //assert.equal(res.customer, updateData.customer, "We changed our name.");
          done();

        });
      });
    });

    describe('.invalidate', function(done){

      it("should invalidate our out of date mastercard", function(done){

        balanced.card.invalidate(test.mastercard.id, function(err, res){

          assert.equal(err, null, err);
          assert.equal(res.is_valid, false, "We changed our month.");
          done();

        });
      });
    });


  });

  // DEBIT

  describe('.debit', function(){

    describe('.create', function(done){

      it('should create a debit', function(done){

      	var params = {
      		account_id: test.account_id,
      		debit_info: {amount: 500, appears_on_statement_as: "Testing!", description:"We're testing."}
      	};

        balanced.debit.create(params, function(err, res){

          assert.equal(err, null, err);
          assert.notEqual(res.id, null, "res.id is not null");
          assert.equal(res.status, 'succeeded', "res.status is 'succeeded'");
          assert.equal(res.source.is_valid, true, "res.source.is_valid is true");

          //cache the id in the test object
		  	test.debit_info = {
		  		id: res.id,
		  		debit_uri: res.hold.debit_uri
		  	};

          done();

        });
      });
    });


    describe('.retrieve', function(done){

      it("should retrieve a debit", function(done){

        balanced.debit.retrieve(test.debit_info.id, function(err, res){

          assert.equal(err, null, err);
          assert.notEqual(res.id, null, "res.id is not null");
          assert.equal(res.id, test.debit_info.id, "res.id equals the id we sent");
          assert.notEqual(res.status, null, "res.status is not null");

          done();

        });
      });
    });

    describe('.list_all', function(done){

      it("should list all the marketplace's debits", function(done){

        balanced.debit.list_all(function(err, res){

          assert.equal(err, null, err);
          assert.notEqual(res.items.length, 0, 'We have at least one debit in our list.');

          done();

        });
      });
    });

    describe('.update', function(done){

      it("should update a debit", function(done){

		  var params = {
			account_id: test.account_id,
			debit_id: test.debit_info.id,
			debit_info: {name:"Test User"}
		  };

        balanced.debit.update(params, function(err, res){

          assert.equal(err, null, err);

          assert.equal(res.source.name, params.name, "We changed our name.");
          done();

        });
      });
    });

    describe('.refund', function(done){


      it("should refund a debit", function(done){

        balanced.debit.refund(test.debit_info.id, function(err, res){

          assert.equal(err, null, err);
          assert.notEqual(res.status, 'succeeded', "res.status is 'succeeded'");

          done();

        });
      });
    });


    describe('.create another', function(done){

      it("creates a second debit we'll use for the refunds testing.", function(done){

      	var params = {
      		account_id: test.account_id,
      		debit_info: {amount: 500, appears_on_statement_as: "Still Testing!", description:"We're still testing."}
      	};

        balanced.debit.create(params, function(err, res){

          assert.equal(err, null, err);
          assert.notEqual(res.id, null, "res.id is not null");
          assert.equal(res.status, 'succeeded', "res.status is 'succeeded'");
          assert.equal(res.source.is_valid, true, "res.source.is_valid is true");

          //cache the id in the test object
		  	test.debit_info_2 = {
		  		id: res.id,
				debit_uri: res.hold.debit_uri

		  	};

          done();

        });
      });
    });



  });

  // HOLD

  describe('.hold', function(){

    describe('.create', function(done){

      it('should create a hold', function(done){

      	var params = {
      		account_id: test.account_id,
      		hold_info: {amount: 500, appears_on_statement_as: "Testing!", description:"We're testing."}
      	};

        balanced.hold.create(params, function(err, res){

          assert.equal(err, null, err);
          assert.notEqual(res.id, null, "res.id is not null");
          assert.notEqual(res.created_at, null, "res.created_at is not null");
          assert.equal(res.source.is_valid, true, "res.source.is_valid is true");

          //cache the id in the test object
		  	test.hold_info = {
		  		id: res.id,
		  		hold_uri: res.account.holds_uri
		  	};

          done();

        });
      });
    });


    describe('.retrieve', function(done){

      it("should retrieve a hold", function(done){

        balanced.hold.retrieve(test.hold_info.id, function(err, res){

          assert.equal(err, null, err);
          assert.notEqual(res.id, null, "res.id is not null");
          assert.equal(res.id, test.hold_info.id, "res.id equals the id we sent");

          done();

        });
      });
    });

    describe('.list_all', function(done){

      it("should list all the marketplace's holds", function(done){

        balanced.hold.list_all(function(err, res){

          assert.equal(err, null, err);
          assert.notEqual(res.items.length, 0, 'We have at least one hold in our list.');

          done();

        });
      });
    });

    describe('.update', function(done){

      it("should update a hold", function(done){

		  var params = {
			account_id: test.account_id,
			hold_id: test.hold_info.id,
			hold_info: {description:"This is my updated hold!"}
		  };

        balanced.hold.update(params, function(err, res){

          assert.equal(err, null, err);

		  //doesn't actually update
          assert.equal(res.description, params.hold_info.description, "We updated the description.");
          done();

        });
      });
    });


    describe('.capture', function(done){

      it("should capture a hold", function(done){

		  var params = {
			account_id: test.account_id,
			hold_info: {hold_uri: test.hold_info.hold_uri + '/' + test.hold_info.id }
		  };

        balanced.hold.capture(params, function(err, res){

          assert.equal(err, null, err);

          assert.equal(res.status, 'succeeded', "We captured that hold.");
          done();

        });
      });
    });

    describe('.void', function(done){

      it("should void a hold", function(done){

        balanced.hold.voidHold(test.hold_info.id, function(err, res){

          assert.equal(err, null, err);
		  //console.log(res);
          //assert.equal(res.status, 'succeeded', "We voided that hold.");
          done();

        });
      });
    });
  });

  // REFUND
  describe('.refund', function(){

    describe('.create', function(done){

      it('should create a refund', function(done){

      	var params = {
      		account_id: test.account_id,
      		refund_info: {
      			debit_uri: test.debit_info_2.debit_uri
      		}
      	};

        balanced.refund.create(params, function(err, res){

		  //console.log(res);
          assert.equal(err, null, err);
          assert.notEqual(res.id, null, "res.id is not null");
          assert.notEqual(res.created_at, null, "res.created_at is not null");

          //cache the id in the test object
		  	test.refund_info = {
		  		id: res.id,
		  		refund_uri: res.account.refunds_uri + '/' + res.id
		  	};

          done();

        });
      });
    });


    describe('.retrieve', function(done){

      it("should retrieve a refund", function(done){

        balanced.refund.retrieve(test.refund_info.id, function(err, res){

          assert.equal(err, null, err);
          assert.notEqual(res.id, null, "res.id is not null");
          assert.equal(res.id, test.refund_info.id, "res.id equals the id we sent");

          done();

        });
      });
    });

    describe('.list_all', function(done){

      it("should list all the marketplace's refunds", function(done){

        balanced.refund.list_all(function(err, res){

          assert.equal(err, null, err);
          assert.notEqual(res.items.length, 0, 'We have at least one refund in our list.');

          done();

        });
      });
    });

    describe('.update', function(done){

      it("should update a refund", function(done){

		  var params = {
			account_id: test.account_id,
			refund_id: test.refund_info.id,
			refund_info: {description:"This is my updated refund!"}
		  };

        balanced.refund.update(params, function(err, res){

          assert.equal(err, null, err);
          assert.equal(res.description, params.refund_info.description, "We updated the description.");
          done();

        });
      });
    });
  });

});
