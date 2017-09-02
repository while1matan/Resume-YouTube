var last_url_query_data = "";

//var cookie_separator = "|,|";
var short_title_length = 30;

var use_localStorage = (typeof(Storage) !== "undefined");

//DOMupdate();

// http://stackoverflow.com/a/34100952/7550127
document.addEventListener("spfdone", DOMupdate);
document.addEventListener("DOMContentLoaded", DOMupdate);

// CHECK & UPDATE LAST SAVED PLAYLIST VIDEO
function DOMupdate(){
	//console.log("dom updated");

	var query = pageParams();

	// this page is part of a list?
	if("list" in query){
		console.log("list: " + query['list']);
		
		var saved_video = getSavedPlaylistVideo(query['list']);
		
		// this page containing video?
		if("v" in query){
			if(query['v'] != saved_video.vid){
				var v_title = document.getElementById("eow-title").innerText;
				savePlaylistVideo(query['list'] , query['v'] , v_title);
			}
			else {
				saved_video.vid = "";	// don't link to the same video
			}
		}
		
		// found last watched video?
		if(saved_video.vid != ""){
			console.log("playlist saved video: " + saved_video.vid);
			showLastVideoLink(saved_video);
		}
		else {
			//console.log("this playlist has no video saved");
		}
	}
}

// -----------------------------------------
//	URL DATA
// -----------------------------------------

// GET PAGE QUERY PARAMS
// http://stackoverflow.com/a/2880929/7550127
function pageParams(){
	var params = {};
	
	var query = window.location.search.substring(1);
	
	var regex = /([^&=]+)=?([^&]*)/g;
	
	while(match = regex.exec(query)){
		params[ decodeURIComponent(match[1]) ] = decodeURIComponent(match[2]);
	}
	
	return params;
}

// -----------------------------------------
//	DOM/UI CHANGES
// -----------------------------------------

function showLastVideoLink(saved_video){
	switch (window.location.pathname){
		case "/watch": {
			addLinkInVideoPage(saved_video);
			break;
		}
		case "/playlist": {
			addLinkInPlaylistPage(saved_video);
			break;
		}
	}
}

function addLinkInVideoPage(saved_video){
	var pl_controls = document.querySelector("#watch-appbar-playlist .playlist-nav-controls");
	
	var a_link = document.createElement("a");
	a_link.className = "yt-uix-button yt-uix-button-player-controls";
	a_link.style = "color: #ff712d;"
	a_link.innerHTML = "חזור אל '" + escapeHtml(saved_video.short_title) + "'";
	a_link.href = prepareLinkToListVideo(saved_video.listid , saved_video.vid);
	
	pl_controls.appendChild(a_link);
}

function addLinkInPlaylistPage(saved_video){
	var pl_controls = document.querySelector("#pl-header .playlist-actions");
	
	var a_link = document.createElement("a");
	a_link.className = "yt-uix-button yt-uix-button-default";
	a_link.style = "background-color: #ff7c3e;"
	a_link.innerHTML = "חזור אל '" + escapeHtml(saved_video.title) + "'";
	a_link.href = prepareLinkToListVideo(saved_video.listid , saved_video.vid);
	
	pl_controls.appendChild(a_link);
}

function prepareLinkToListVideo(listid , vid){
	return "/watch?v=" + escapeHtml(vid) + "&list=" + escapeHtml(listid);
}

// http://stackoverflow.com/a/6234804/7550127
function escapeHtml(unsafe) {
	return unsafe
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

// -----------------------------------------
//	COOKIES
// -----------------------------------------

function getPlaylistCookieName(listid){
	return "w1_resume_list[" + listid + "]";
}

function savePlaylistVideo(listid, vid, title){
	var save_data = {
		"vid"	: vid,
		"title"	: title
	};
	
	if(use_localStorage){
		localStorage.setItem(getPlaylistCookieName(listid), JSON.stringify(save_data));
	}
	else {
		setCookie(getPlaylistCookieName(listid) , JSON.stringify(save_data) , 60*60*24*30 , "");
	}
}

function getSavedPlaylistVideo(listid){
	
	var list_key = getPlaylistCookieName(listid);
	
	// even if we use localStorage, load cookie for upgrading
	var cookie_data = getCookie(list_key);
	
	if(use_localStorage){
		data = localStorage.getItem(list_key);
		
		// UPGRADE DATA STORAGE (from cookies to localStorage)
		if(data == null && cookie_data != ""){
			//console.log("upgrading list cookie");
			localStorage.setItem(list_key, cookie_data);
			data = cookie_data;
			removeCookie(list_key);
		}
	}
	else {
		data = cookie_data;
	}
	
	var saved_data = {};
	
	try {
		saved_data = JSON.parse(data);
	}
	catch(e) {
		saved_data.vid = "";
		saved_data.title = "";
	}
	
	if(saved_data == null){
		saved_data = {
			"vid"	: "",
			"title"	: ""
		};
	}
	
	return {
		"listid"		: listid,
		"vid"			: saved_data.vid,
		"title"			: saved_data.title,
		"short_title"	: saved_data.title.substring(0,short_title_length) + ((saved_data.title.length > short_title_length)? "..." : "")
	};
}

// SAVE COOKIE
function setCookie(name , value , ttl , path){
	if(isNaN(ttl))	ttl = 0;
	if(path == "")	path = "/";
	
	var d = new Date();
	d.setTime( d.getTime() + (ttl * 1000) );
	
	document.cookie = name + "=" + value + "; expires=" + d.toUTCString() + "; path=" + path;
	
	return true;
}

// REMOEV COOKIE
function removeCookie(name){
	return setCookie(name , "" , -60*60*24*30 , "");
}

// GET SAVED COOKIE
function getCookie(name){
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