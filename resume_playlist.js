var debug_enabled = null;	// add &resume_debug to url for debugging mode
var document_timer;
var short_title_length = 55;
var use_localStorage = (typeof(Storage) !== "undefined");

var last_title_in_page = "";
var title_timer;
var title_retries = 120;

// waitForDocument();

// http://stackoverflow.com/a/34100952/7550127
document.addEventListener("DOMContentLoaded", waitForDocument);
document.addEventListener("spfdone", waitForDocument);	// old youtube design
window.addEventListener("yt-navigate-finish", waitForDocument); // new youtube design

// event listeners detect the changes, but the DOM isn't ready yet :@
// so, we'll keep waiting for it.
function waitForDocument(){
	if(document_timer){
		clearTimeout(document_timer);
	}
	
	print_debug("new timer");
	
	document_timer = setTimeout(function(){		
		print_debug("retry");
		
		// this element seems to appear in all the relevent pages (watch&video),
		// so we don't need to check different elements in each page
		if(document.querySelector(".title.ytd-video-primary-info-renderer") != null){
			onDocumentReallyReady();
		}
		else {
			waitForDocument();
		}
	}, 300);
}

// CHECK & UPDATE LAST SAVED PLAYLIST VIDEO
// * this can be triggered few times for each page, because we check several events
function onDocumentReallyReady(){
	var query = pageParams();

	// this page is part of a list?
	if("list" in query){
		console.log("list: " + query['list']);
		
		var saved_video = getSavedPlaylistVideo(query['list']);
		
		// this page containing video?
		if("v" in query){
			console.log("list video: " + query['v']);
			if(query['v'] != saved_video.vid){
				print_debug("saving...");
				
				// keep this as the last watched video
				savePlaylistVideo(query['list'] , query['v'] , "");
				
				// find the video's title on page, and make sure it is current video's title
				// *if 2 videos as the same title, this will fail and leave the saved video untitled.
				var title_el = document.querySelector("h1.title.ytd-video-primary-info-renderer");
				if(title_el != null){
					title_retries = 120;
					waitForTitleAndUpdate(title_el , query['list'] , query['v']);
				}
				else {
					print_debug("Video's title is missing");
				}				
			}
			else {
				print_debug("already saved");
				saved_video.vid = "";	// don't link to the same video
			}
		}
		
		// found saved video (different from this one)
		if(saved_video.vid != ""){
			print_debug("playlist saved video: " + saved_video.vid);
			showLastVideoLink(saved_video);
		}
	}
}

function waitForTitleAndUpdate(title_el , listid , vid){
	if(title_timer){
		clearTimeout(title_timer);
	}
	
	setTimeout(function(){
		var video_title = title_el.innerText;
		print_debug("found title: " + video_title);
		if(video_title != "" && video_title != last_title_in_page){
			savePlaylistVideo(listid , vid , video_title);
			last_title_in_page = video_title;
		}
		else {
			if(--title_retries >= 0){
				waitForTitleAndUpdate(title_el , listid , vid);
			}
		}
	}, 500);
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
	print_debug("current page: " + window.location.pathname);
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
	var resume_link = document.querySelector("#header-contents .resume-playlist");
	
	if(resume_link == null){
		var list_header = document.querySelector("#header-contents");
		if(list_header != null){
			var resume_row = document.createElement("div");
			resume_row.style = "display: block; margin: 3px 0;";
			
			resume_link = document.createElement("a");
			resume_link.className = "resume-playlist";
			resume_link.style = "color: #ff712d; text-decoration: none;"
			
			resume_row.appendChild(resume_link);
			list_header.appendChild(resume_row);
		}
		else {
			print_debug("Missing list header");
			return;
		}
	}
	
	if(saved_video.title == ""){
		resume_link.innerHTML = "Go to last watched video";
	}
	else {
		resume_link.innerHTML = "Last watched: '" + escapeHtml(saved_video.short_title) + "'";
	}
	resume_link.href = prepareLinkToListVideo(saved_video.listid , saved_video.vid);
}

function addLinkInPlaylistPage(saved_video){
	print_debug("loading ui for playlist page");
	
	var contents = document.querySelector("#contents.style-scope.ytd-playlist-video-list-renderer");
	
	if(contents == null){
		print_debug("Missing contents element");
		return;
	}
	
	var resume_row = document.createElement("div");
	resume_row.style = "display: block; margin: 5px 0;";
	
	var resume_link = document.createElement("a");
	resume_link.className = "resume-playlist";
	resume_link.style = "display: inline-block; color: #ff7c3e; text-decoration: none; font-size: 16px; margin: 5px;"
	if(saved_video.title == ""){
		resume_link.innerHTML = "Go to last watched video";
	}
	else {
		resume_link.innerHTML = "Last watched: '" + escapeHtml(saved_video.title) + "'";
	}
	resume_link.href = prepareLinkToListVideo(saved_video.listid , saved_video.vid);
	
	var resume_remove = document.createElement("button");
	resume_remove.className = "resume-playlist-delete";
	resume_remove.style = "background-color: #ff7c3e; color: #FFFFFF; border: 0; padding: 3px 5px; cursor: pointer;";
	resume_remove.innerHTML = "FORGET";
	resume_remove.onclick = function(){
		if(confirm("Forget the last video that you watched?\nTitle: '" + saved_video.title + "'")){
			removeSavedPlaylistVideo(saved_video.listid);
			resume_row.remove();
			console.log(saved_video.listid + " data removed");
		}
	}
	
	resume_row.appendChild(resume_link);
	resume_row.appendChild(resume_remove);

	contents.insertBefore(resume_row , contents.firstChild);
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
	
	print_debug(save_data);
	
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
			print_debug("upgrading list cookie");
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

function removeSavedPlaylistVideo(listid){
	if(use_localStorage){
		localStorage.removeItem(getPlaylistCookieName(listid));
	}
	else {
		removeCookie(getPlaylistCookieName(listid));
	}
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

// -----------------------------------------
//	DEBUGGING
// -----------------------------------------

function print_debug(data){
	if(isDebugging()){
		console.log(data);
	}
}

function isDebugging(){
	if(debug_enabled == null){
		var query = pageParams();
		debug_enabled = ("resume_debug" in query);
	}
	
	return debug_enabled;
}