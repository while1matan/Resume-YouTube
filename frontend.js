var resumer = {
	
	player:			null,
	current_vid:	"",
	
	enabled:		false,
	toggle_button:	null,
	seek_to:		0,
	
	waiting:		false,	// waiting for new video
	waitTimer:		null,
	
	watchTimer:		null,
	watch_seconds:	5,
	
	STATE_UNSTARTED: -1,
	STATE_PLAYING:	1,
	STATE_PAUSED:	2,
	STATE_CUED:		5,
	
	cookie_prefix:	"w1_resume",
	cookie_life:	60*60*24*30,	// seconds
	
	use_localStorage:	false,
	
	// -----------------------------------------
	//	START HERE
	// -----------------------------------------
	
	init: function(){
		if(typeof(Storage) !== "undefined"){
			this.use_localStorage = true;
			console.log("<Using LocalStorage>");
		}
		else {
			this.use_localStorage = false;
			console.log("<Using Cookies>");
		}
	
		if(!this.loadPlayer()){
			console.log("Invalid player element");
			return;
		}
		
		this.addPlayerUI();
		
		this.player.addEventListener(
			"onStateChange",
			this.onVideoStateChange.bind(this)
		);
		
		// manually execute first-time video loading
		this.waitForNewVideo();
	},
	
	// -----------------------------------------
	//	VIDEO PLAYER
	// -----------------------------------------
	
	// FIND THE VIDEO ELEMENT
	// javascript shouts when the player is invalid, although we check the element.
	// try-catch calm it down.
	loadPlayer: function(){
		try {
			var check_player = document.getElementById("movie_player");
			if(typeof(check_player.getPlayerState) === 'function'){
				this.player = check_player;
			}
		}
		catch (e){
			return false;
		}
		
		return true;
	},
	
	// GET CURRENT VIDEO ID
	getVideoId: function(){
		return this.player.getVideoData().video_id;
	},
	
	// ADD RESUMER UI TO YOUTUBE PLAYER
	addPlayerUI: function(){
		var controls = document.querySelector("#movie_player .ytp-left-controls");
		
		toggle_button = document.createElement("a");
		
		toggle_button.innerHTML = "RESUME";
		toggle_button.className = "ytp-button";
		toggle_button.style = "padding: 0 5px; vertical-align: top; font-weight: bold; width: auto;"; /* doesnt support full screen:: width: 55px; line-height: 35px; */
		
		toggle_button.onclick = this.toggleAutoSave.bind(this);
		
		controls.appendChild(toggle_button);
	},
	
	// WHEN VIDEO STATE IS CHANGED...
	onVideoStateChange: function(newState){
		//console.log("new state: " + newState);
		
		if(newState == this.STATE_UNSTARTED){
			this.stopWatchTimer();
			this.waitForNewVideo();
		}
		
		if(this.enabled && !this.waiting){
			if(newState == this.STATE_PLAYING){
				if(this.seek_to != 0){
					this.player.seekTo(this.seek_to);
					this.seek_to = 0;
				}
				
				this.startWatchTimer();
			}
			else {
				if(newState == this.STATE_PAUSED){
					this.saveCurrentTime();
				}
				
				this.stopWatchTimer();
			}
		}
	},
	
	// VIDEO IS CHANGING, WAIT UNTIL NEW VIDEO DATA IS AVAILABLE
	// (I added this because the video-data is changed in different player-state in each time)
	// [IDEA TO DO: check new video-id on STATE_PLAYING, and then if new video available, seek to position immediately]
	waitForNewVideo: function(){
		this.waiting = true;
		
		// check for new video-id
		var new_vid = this.getVideoId();

		//console.log("waiting... [" + new_vid + "]");
		
		if(new_vid == this.current_vid){
			if(this.waitTimer){
				clearTimeout(this.waitTimer);
			}
			
			this.waitTimer = setTimeout(
				this.waitForNewVideo.bind(this),
				200
			);
			
			return;
		}
		
		// update new video-id
		this.current_vid = new_vid;
		
		this.waiting = false;
		
		// update video data
		this.videoLoaded();
		
		// update player if state changed
		var current_state = this.player.getPlayerState();
		if(current_state != this.STATE_UNSTARTED){
			this.onVideoStateChange( current_state );
		}
	},
	
	// WHEN NEW VIDEO IS LOADED...
	videoLoaded: function(){		
		console.log("new video: " + this.current_vid);
		
		var saved_time = this.getSavedTime(this.current_vid);
		
		if(saved_time !== false){
			// we will seek to position when player start playing the video,
			// otherwise we get an error from youtube (maybe bug in their side)
			this.seek_to = saved_time;
			console.log("saved time: " + saved_time);
			this.enableAutoSave();
		}
		else {
			this.disableAutoSave();
		}
	},
	
	// -----------------------------------------
	//	TIMERS
	// -----------------------------------------
	
	// START TIMER
	startWatchTimer: function(){
		this.stopWatchTimer();
		
		this.watchTimer = setInterval(
			this.saveCurrentTime.bind(this),
			this.watch_seconds * 1000
		);
	},
	
	// STOP TIMER
	stopWatchTimer: function(){
		if(this.watchTimer){
			clearInterval(this.watchTimer);
		}
	},
	
	// -----------------------------------------
	//	AUTO-SAVE STATE
	// -----------------------------------------
	
	// TOGGLE AUTO-SAVE STATE
	toggleAutoSave: function(){
		if(this.enabled){
			this.disableAutoSave();
		}
		else {
			this.enableAutoSave();
			this.onVideoStateChange( this.player.getPlayerState() );
		}
	},
	
	// ENABLE AUTO-SAVE
	enableAutoSave: function(){
		this.enabled = true;
		toggle_button.style.color = "#00FF00";
	},
	
	// DISABLE AUTO-SAVE
	disableAutoSave: function(){
		this.enabled = false;
		toggle_button.style.color = "";
		
		this.stopWatchTimer();
		this.clearSavedTime(this.current_vid);
	},
	
	// -----------------------------------------
	//	SAVED TIME
	// -----------------------------------------
	
	// SAVE CURREMT VIDEO TIME
	saveCurrentTime: function(){
		if(this.use_localStorage){
			localStorage.setItem(this.getVideoCookieName(this.current_vid), this.player.getCurrentTime());
		}
		else {
			this.setCookie(this.getVideoCookieName(this.current_vid) , this.player.getCurrentTime() , this.cookie_life , "");
		}
		
		//console.log(this.player.getPlayerState() + " :: " + this.player.getCurrentTime());
	},
	
	// GET SAVED TIME OF VIDEO
	getSavedTime: function(vid){
		var saved_time = "";
		var vid_key = this.getVideoCookieName(vid);
		
		// even if we use localStorage, load cookie for upgrading
		var saved_cookie = this.getCookie(vid_key);
		
		if(this.use_localStorage){
			saved_time = localStorage.getItem(vid_key);
			
			// UPGRADE DATA STORAGE (from cookies to localStorage)
			if(saved_time == null && saved_cookie != ""){
				//console.log("upgrading cookie");
				localStorage.setItem(vid_key, saved_cookie);
				saved_time = saved_cookie;
				this.removeCookie(vid_key);
			}
		}
		else {
			saved_time = saved_cookie;
		}
		
		if(saved_time != "" && saved_time != null){
			return saved_time;
		}
		
		return false;
	},
	
	// REMOVE SAVED TIME FOR VIDEO
	clearSavedTime: function(vid){
		localStorage.removeItem(this.getVideoCookieName(vid));
		this.removeCookie(this.getVideoCookieName(vid));
	},
	
	// -----------------------------------------
	//	COOKIES
	// -----------------------------------------
	
	getVideoCookieName: function(vid){
		return this.cookie_prefix + "[" + vid + "]";
	},
	
	// SAVE COOKIE
	setCookie: function(name , value , ttl , path){
		if(isNaN(ttl))	ttl = 0;
		if(path == "")	path = "/";
		
		var d = new Date();
		d.setTime( d.getTime() + (ttl * 1000) );
		
		document.cookie = name + "=" + value + "; expires=" + d.toUTCString() + "; path=" + path;
		
		return true;
	},

	// REMOEV COOKIE
	removeCookie: function(name){
		return this.setCookie(name , "" , -60*60*24*30 , "");
	},

	// GET SAVED COOKIE
	getCookie: function(name){
		var cookies = document.cookie.split(';');
		var search = name + "=";
		
		for(var c = 0; c < cookies.length; c++){
			var cookie = cookies[c];
			
			while (cookie.charAt(0) == ' '){
				cookie = cookie.substring(1);
			}
			
			if (cookie.indexOf(search) == 0){
				return cookie.substring(search.length,cookie.length);
			}
		}
		
		return "";
	}
	
}

console.log("- Youtube Resumer / by Matan Mizrachi (while1.co.il) -");
resumer.init();