const selfVideo = document.getElementById('self');
const otherVideo = document.getElementById('other');
const startBtn = document.getElementById('btn_connection_start');
const endBtn = document.getElementById('btn_connection_end');
const chatBtn = document.getElementById('chat_btn');
const USER_DB = 'user';


chatBtn.disabled = true;
endBtn.disabled = true;
startBtn.disabled = true;
let socket;
let localStream;

//Configure Peers
let selfPeer = new RTCPeerConnection({
	iceServers: [
		{ urls: ["stun:stun.l.google.com:19302"] }
	]
});
let othrPeer = new RTCPeerConnection({
	iceServers: [
		{ urls: ["stun:stun.l.google.com:19302"] }
	]
});


//get ip info first
axios.get('/api')
	.then(function (response) {
		socket = io('ws://localhost:3000', {
			query: {
				ipDetails: response.data.ipInfo,
				ip: response.data.ip,
				user: getUserFromDb()
			}
		});

		//candidate exchange
		socket.on('candidate', data => {
			const { candidate, id, type } = data;
			if (candidate != null) {
				if (type == 'self')
					othrPeer.addIceCandidate(new RTCIceCandidate(candidate));

				if (type == 'other')
					selfPeer.addIceCandidate(new RTCIceCandidate(candidate));
			}
		});

		// ad tracks
		othrPeer.ontrack = track => {
			otherVideo.srcObject = track.streams[0];
		}


		//emit ice
		selfPeer.onicecandidate = (event) => {
			socket.emit('candidate', { candidate: event.candidate, id: socket.id, type: 'self' });
		};

		othrPeer.onicecandidate = (event) => {
			socket.emit('candidate', { candidate: event.candidate, id: socket.id, type: 'other' });
		};

		//get offer for video
		socket.on('offer', async data => {
			const { offer, id } = data;
			await othrPeer.setRemoteDescription(new RTCSessionDescription(offer));
			const desc = await othrPeer.createAnswer();
			await othrPeer.setLocalDescription(new RTCSessionDescription(desc));
			socket.emit('answer', { answer: desc, id: socket.id })
		});

		//answer offer for  video
		socket.on('answer', async data => {
			const { answer } = data;
			await selfPeer.setRemoteDescription(new RTCSessionDescription(answer))
		});

		//room closed
		socket.on('second-disconnected', () => {
			endBtn.disabled = true;
			startBtn.disabled = true;
			chatBtn.disabled = true;
			if (localStream)
				localStream.getTracks().forEach(track => track.stop());
			// selfPeer.close();
			// othrPeer.close();
			selfVideo.srcObject = null;
			otherVideo.srcObject = null;
		});

		//room created
		socket.on('second-connected', () => {
			startBtn.disabled = false;
			chatBtn.disabled = false;
		});



		//chat get
		socket.on('chat-msg', data => {
			const { msg } = data;
			const chatBody = document.getElementById('chat-body');
			const div = document.createElement('div');
			div.classList.add('chat-content');
			const p = document.createElement('p');
			p.innerText = msg;
			div.appendChild(p);
			chatBody.appendChild(div);
		});

	});


//chat send 
chatBtn.addEventListener('click', (event) => {
	const msg = document.getElementById('chatMsg').value;

	socket.emit('chat-msg', { msg, id: socket.id });


});


startBtn.addEventListener('click', () => {
	startBtn.disabled = true;
	endBtn.disabled = false;
	if (socket) {
		navigator.mediaDevices.getUserMedia({
			video: {
				aspectRatio: '1.33',
				height: '360'
			}
		}).then(stream => {
			//get video stream
			selfVideo.srcObject = stream;
			localStream = stream;
			stream.getTracks().forEach(track => {
				selfPeer.addTrack(track, stream);
			});

			//create offer to the other
			selfPeer.createOffer().then(async offer => {
				await selfPeer.setLocalDescription(new RTCSessionDescription(offer));
				socket.emit('offer', { offer, id: socket.id });
			});
		});
	}
});



//call end clicked
endBtn.addEventListener('click', (event) => {
	endBtn.disabled = true;
	startBtn.disabled = false;
	localStream.getTracks().forEach(track => track.stop());
	selfPeer.close();
	othrPeer.close();
	selfVideo.srcObject = null;
	otherVideo.srcObject = null;

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


function random_id() {
	return '_' + (
		Number(String(Math.random()).slice(2)) +
		Date.now() +
		Math.round(performance.now())
	).toString(36);
}