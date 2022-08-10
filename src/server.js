import express from "express";
import http from "http";
import createError from 'http-errors';
import cors from 'cors';
import session from 'express-session';
import {sessionConfig} from './sessionConfig';
import passport from "passport";
import { isLoggedIn, isNotLoggedIn } from "./routes/authMiddle";
// import cookieParser from 'cookie-parser';
import dbpool from './lib/db';
const setAuth = require('./passport');

// 세션 저장소
const FileStore = require('session-file-store')(session);

// 라우터 임포트
import authRouter from './routes/auth';
import apiMember from './routes/member';
import apiCanvas from './routes/canvas';
import WebSocket from './routes/socket';
import ingameRouter from './routes/ingame';
import lobbyRouter from './routes/lobby';


export let userInfo = {}


const app = express(); // app = express instance
setAuth();

// CORS Setting
let corsOptions = {
    // origin: 'https://d17xe7xfw04d2o.cloudfront.net', // 진호
    // origin: 'https://d2bxvfgokknit.cloudfront.net', // 혜린
    origin: 'https://marfiarte.click', // 재관
    // origin: 'https://d1cbkw060yb1pg.cloudfront.net',  // 해인
    credentials: true
}   
app.use(cors(corsOptions));

// 미들웨어 세팅ß
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
// app.use(cookieParser());

app.set('trust proxy', 1);
app.use(session({
    resave: false,
    saveUninitialized: false,
    secret: sessionConfig.secret,
    store: new FileStore(),
    cookie: {
        httpOnly: true,
        // domain: "mafiarte.click", // 진호
        // domain: "hyerexx.click", // 혜린
        domain: "api.marfiarte.click", // 재관
        // domain: "haein-sidee.click", // 해인
        path: '/',
        secure: true,
        sameSite: 'None'
    },
}));

// domain: "marfiarte.click",
// secure: true,
// sameSite: 'None'

// Auth 초기화 - express-session에 의존하므로 뒤에 위치시킴
app.use(passport.initialize()); // req 객체에 passport 설정을 심음 (login, logout, isAuthenticated 등)
app.use(passport.authenticate('session'));
// app.use(passport.session()); // req.session 객체에 passport정보를 추가

// routes
app.use('/api/auth', authRouter);
app.use('/api/canvas', apiCanvas);
app.use('/api/member', apiMember);
app.use('/api/ingame', ingameRouter);
app.use('/api/lobby', lobbyRouter);


// 정적 data 제공 - react에서 자체적으로 정적 data제공하나 임시로 남겨둠. 추후 불필요시 삭제 가능할듯.
app.use("/public", express.static(__dirname + "/public"));

// 잘못된 주소로 접근했을 경우 에러처리 (에러발생 및 핸들러)
app.use((err, req, res, next) => {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};
    // render the error page
    next(createError(404));
    res.status(err.status || 500);
});

// create server하려면 request Listner 경로가 있어야 함. 당연.
const httpServer = http.createServer(app); 
WebSocket(httpServer);
httpServer.listen(3000, () => console.log(`Listening on http://localhost:3000`));