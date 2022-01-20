require('dotenv').config();

const express = require('express');
const app = express();
const path = require('path');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const { db } = require('./configs/db.config');
const session = require('express-session');
const passport = require('passport');
const fs = require('fs');
const https = require('https');

/* ============== Import middleware =============== */
const {
	checkInitSystemMiddleware,
} = require('./middleware/init-system.middleware');
const {
	authMiddleware,
	adminAuthorizationMiddleware,
	mgmtAuthorizationMiddleware,
	userAuthorizationMiddleware,
} = require('./middleware/auth.middleware');
const { passSidebarStatus } = require('./middleware/mgmt-session.middleware');
const passVariableMiddleware = require('./middleware/pass-variable.middleware');

/* ============== Import routes =============== */
const { MAX } = require('./constants/index.constant');
const { unlessRoute } = require('./middleware/unless.middleware');
const adminRoute = require('./routes/admin/index.route');
const apiRoute = require('./routes/api.route');
const authRoute = require('./routes/auth.route');
const homeRoute = require('./routes/home.route');
const initSystemRoute = require('./routes/init-system.route');
const managementRoute = require('./routes/management/index.route');
const userRoute = require('./routes/user/index.route');

/* ============== Config =============== */
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '5MB' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(process.env.SIGNED_COOKIE || 'signed_cookie'));
app.use(
	session({
		secret: process.env.SESSION_SECRET || 'session_secret',
		resave: false,
		saveUninitialized: true,
		cookie: {
			maxAge: MAX.SESSION_EXP,
		},
	})
);
app.use(passport.initialize());
app.use(passport.session());

// set view engine
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

// https for localhost and wake up heroku server in production
let server = app;
if (process.env.NODE_ENV?.trim() === 'development') {
	const key = fs.readFileSync(__dirname + '/key/key.pem');
	const cert = fs.readFileSync(__dirname + '/key/cert.pem');
	const options = {
		key: key,
		cert: cert,
	};
	process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
	server = https.createServer(options, app);

	// set logging
	app.use(morgan('tiny'));
} else {
	app.disable('x-powered-by');
	app.use(morgan('common'));
	app.get('/', (req, res) => {
		res.sendFile(path.join(__dirname, '/src/build', 'index.html'));
	});

	// Auto wake up heroku
	app.get('/wakeup-heroku', (req, res) => res.send(''));
	const timer = 25 * 60 * 1000; // 25 minutes
	setInterval(() => {
		https.get('https://cp-management.herokuapp.com/wakeup-heroku');
	}, timer);
}

/* ============== Global Middleware =============== */
app.use(unlessRoute([], checkInitSystemMiddleware));
app.use(
	unlessRoute(
		['/auth', '/init-system', '/api/new-payment-history', '/'],
		authMiddleware
	)
);
app.use(unlessRoute([], passVariableMiddleware));

/* ============== Routes =============== */
app.use('/init-system', initSystemRoute);
app.use('/api', apiRoute);
app.use('/auth', authRoute);
app.use('/admin', adminAuthorizationMiddleware, passSidebarStatus, adminRoute);
app.use(
	'/management',
	mgmtAuthorizationMiddleware,
	passSidebarStatus,
	managementRoute
);
app.use('/user', userAuthorizationMiddleware, userRoute);
app.use('/', homeRoute);

// 404 Not found redirect
app.use((req, res) => res.render('404.pug'));

/* ============== Listening =============== */
const normalizePort = (port) => parseInt(port, 10);
const PORT = normalizePort(process.env.PORT || 3000);

db.sync({ after: true }).then((_) => {
	server.listen(PORT, () => {
		console.log(`Server is listening on port ${PORT}`);
	});
});
