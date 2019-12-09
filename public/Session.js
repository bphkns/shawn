var session = require('express-session');

// TODO -> 1 STORE THE CURRENT USERS GENDER PREFERENCE
app.use(session({
	key: 'current_user_gender_preference',
	secret: '',
	resave: false,
	saveUninitialized: true
}));

// TODO: // 2 STORE CURRENT USERS GENDER (BTN -> I AM (MALE /FEMALE DROPDOWN))
app.use(session({
	key: 'current_user_gender',
	secret: '',
	resave: false,
	saveUninitialized: true
}));

// TODO: // 3 STORE CURRENT USERS TOTAL PAYPAL TOKENS (1 + 2 = 3)
app.use(session({
	key: 'current_user_total_tokens',
	secret: 5000,
	resave: false,
	saveUninitialized: true
}));







// TODO -> 3 STORE THE CURRENT USERS COUNTRY PREFERENCE  (SKIP THIS)
app.use(session({
	key: 'current_user_country_preference',
	secret: '',
	resave: false,
	saveUninitialized: true
}));
// TODO: // STORE CURRENT USERS COUNTRY (SKIP THIS)
app.use(session({
	key: 'current_user_country',
	secret: '',
	resave: false,
	saveUninitialized: true
}));
// TODO: // STORE CURRENT USERS IP (SKIP THIS)
app.use(session({
	key: 'current_user_ip',
	secret: '',
	resave: false,
	saveUninitialized: true
}));
// TODO: // STORE CURRENT USERS SOCKET ID (SKIP THIS)
app.use(session({
	key: 'current_user_socket_id',
	secret: '',
	resave: false,
	saveUninitialized: true
}));
