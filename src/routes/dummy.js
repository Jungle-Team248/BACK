// export default class Game {
//     constructor(gameId, socket) {
//         this.gameId = gameId;
//         this.socket = socket;
        
//         this.socket.on("onTest", () => this.test(123));
//     }

//     test(data) {
//         console.log(data);
//         console.log("getcha!");
//     }
// }

let user = {}
let dummy = {id : 1, pass : 1}

user[1] = dummy
console.log(user)

dummy.id = 2
console.log(user)

user[1]['id'] = 3
user[1]['extra'] = 33
console.log(user)

user[1]['extra'] = 44

user[2] = {id : 2, pass : 2};
user[3] = {id : 3, pass : 3};
console.log(user)

// dummy.forEach(dum => {
//     console.log(dum);
// });

Object.keys(user).forEach((id) => {
    console.log(id)
});

// for (const property in dummy) {
//     console.log(property);
// }

let data = {123 : {id : 1, pass : 1}, 234 : {id : 2, pass : 2}}
console.log(data);
delete data[123];
console.log(data);
