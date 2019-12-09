const selfVideo = document.getElementById('self');
const otherVideo = document.getElementById('other');
const startBtn = document.getElementById('btn_connection_start');
const endBtn = document.getElementById('btn_connection_end');
const chatBtn = document.getElementById('chat_btn');
const chatLeftBody = document.getElementById('chat-left-body');
const chatRightBody = document.getElementById('chat-right-body');
const chatMsg = document.getElementById('chatMsg');
const USER_DB = 'user';

chatMsg.disabled = true;
chatBtn.disabled = true;
endBtn.disabled = true;
startBtn.disabled = true;
let socket;
let localStream;
let localChatMessages = [];
let remoteChatMessages = [];

//get or set user
const user = getUserFromDb();


//Configure Peers
let selfPeer;
let otherPeer;


//get ip info first
axios.get('/api')
	.then(function (response) {
		socket = io('wss://bphkns.loclx.io', {
			query: {
				ipDetails: response.data.ipInfo.country, //send country
				ip: response.data.ip, //send ip
				id: user.id //send local userId
			}
		});

		socket.on('ready-for-pairing', () => {
			startBtn.disabled = false;
		});

		//candidate exchange
		socket.on('candidate', data => {
			const { candidate, type } = data;
			if (candidate != null) {
				if (type == 'self')
					otherPeer.addIceCandidate(new RTCIceCandidate(candidate));

				if (type == 'other')
					selfPeer.addIceCandidate(new RTCIceCandidate(candidate));
			}
		});

		//create fresh offer for new client
		socket.on('send-new-offer', async () => {
			await createOfferForOther();
		});

		//get offer for video
		socket.on('offer', async data => {
			const { offer } = data;
			await otherPeer.setRemoteDescription(new RTCSessionDescription(offer));
			const desc = await otherPeer.createAnswer();
			await otherPeer.setLocalDescription(new RTCSessionDescription(desc));
			socket.emit('answer', { answer: desc, id: user.id })
		});

		//answer offer for  video
		socket.on('answer', async data => {
			const { answer } = data;
			await selfPeer.setRemoteDescription(new RTCSessionDescription(answer));
			chatBtn.disabled = false;
		});

		//room closed
		socket.on('pairing-end', () => {
			endBtn.disabled = true;
			startBtn.disabled = false;
			chatBtn.disabled = true;
			if (localStream)
				localStream.getTracks().forEach(track => track.stop());
			selfPeer.close();
			otherPeer.close();
			selfVideo.srcObject = null;
			otherVideo.srcObject = null;
		});


		//chat get
		socket.on('chat-msg', data => {
			const { msg } = data;
			const div = document.createElement('div');
			div.classList.add('chat-content');
			const p = document.createElement('p');
			remoteChatMessages.push[msg];
			p.innerText = msg;
			div.appendChild(p);
			chatLeftBody.appendChild(div);
		});

	});


//chat send 
chatBtn.addEventListener('click', (event) => {
	const msg = chatMsg.value;

	socket.emit('chat-msg', { msg, id: user.id });
	const div = document.createElement('div');
	div.classList.add('chat-content');
	const p = document.createElement('p');
	localChatMessages.push[msg];
	p.innerText = msg;
	div.appendChild(p);
	chatRightBody.appendChild(div);
	chatMsg.value = "";


});

chatMsg.addEventListener('keyup', (event) => {
	if (event.keyCode === 13) {
		const msg = chatMsg.value;

		socket.emit('chat-msg', { msg, id: user.id });
		const div = document.createElement('div');
		div.classList.add('chat-content');
		const p = document.createElement('p');
		localChatMessages.push[msg];
		p.innerText = msg;
		div.appendChild(p);
		chatRightBody.appendChild(div);
		chatMsg.value = "";
	}
});


startBtn.addEventListener('click', async () => {
	startBtn.disabled = true;
	endBtn.disabled = false;
	if (socket) {
		socket.emit('start-pairing', { id: user.id }, async () => {
			const stream = await navigator.mediaDevices.getUserMedia({
				video: {
					aspectRatio: '1.33',
					height: '360'
				},
				audio: {
				}
			});

			//get video stream
			selfVideo.srcObject = stream;
			localStream = stream;

			// initiate rtc peer object
			selfPeer = createPeer();
			otherPeer = createPeer();

			//add tracks to the stream
			stream.getTracks().forEach(track => {
				selfPeer.addTrack(track, stream);
			});

			// add tracks
			otherPeer.ontrack = track => {
				otherVideo.srcObject = track.streams[0];
			}

			//emit ice
			selfPeer.onicecandidate = (event) => {
				socket.emit('candidate', { candidate: event.candidate, id: user.id, type: 'self' });
			};

			otherPeer.onicecandidate = (event) => {
				socket.emit('candidate', { candidate: event.candidate, id: user.id, type: 'other' });
			};

			await createOfferForOther();
		});
	}
});


async function createOfferForOther() {
	//create offer to the other
	const offer = await selfPeer.createOffer();
	await selfPeer.setLocalDescription(new RTCSessionDescription(offer));
	socket.emit('offer', { offer, id: user.id });
}



//call end clicked
endBtn.addEventListener('click', (event) => {
	endBtn.disabled = true;
	startBtn.disabled = false;
	localStream.getTracks().forEach(track => track.stop());
	selfPeer.close();
	otherPeer.close();
	selfVideo.srcObject = null;
	otherVideo.srcObject = null;
	socket.emit('stop', { id: user.id });
});


//get user from localstorage
function getUserFromDb() {
	let user = localStorage.getItem(USER_DB);
	if (!user) {
		user = {
			id: random_id()
		};
		localStorage.setItem(USER_DB, JSON.stringify(user));

		return user;
	}
	return JSON.parse(user);
}

//logging out current user
function logout() {
	localStorage.removeItem(USER_DB);
	return true;
}

//generate id for user
function random_id() {
	return '_' + (
		Number(String(Math.random()).slice(2)) +
		Date.now() +
		Math.round(performance.now())
	).toString(36);
}

//create peer object
function createPeer() {
	return new RTCPeerConnection({
		iceServers: [
			{ urls: ["stun:stun.l.google.com:19302"] }
		]
	});
}