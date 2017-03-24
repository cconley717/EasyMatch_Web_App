var loggedInUID;
var hasProfile;

//this callback is fired when the user either logs in or logs out
firebase.auth().onAuthStateChanged(function(user)
{
	if (user)
	{
		//var thing = firebase.auth().currentUser;
		//alert('logged in: ' + thing.photoURL);
		//alert('logged in');
		loggedInUID = user.uid;
		
		showLoggedInHeader();
		updateLastVisitTimestamp(Date.now());
		
		firebase.database().ref('profiles').child(loggedInUID).once("value").then(function(snapshot) {
			if(snapshot.child("hasProfile").exists() && snapshot.val().hasProfile)
				hasProfile = true;
			else
				hasProfile = false;
		});
	}
	else
	{
		//alert('logged out');
		loggedInUID = null;
		hasProfile = false;
		showLoggedOutHeader();
	}
	
	showTop50Profiles();
	closeCurrentPopup();
});

/*
The user's lastVisitTimestamp is updated within the database.
This is used for ranking users on the front page when the site is visited.
When the site is visited, the most recent 50 users are shown.
They will appear within the 50 most recent visitors on the front page for as long as they remain in the top-50.
*/
function updateLastVisitTimestamp(lastVisitTimestamp)
{
	firebase.database().ref('profiles/' + loggedInUID).update({lastVisitTimestamp: lastVisitTimestamp})
	.then(function()
	{
		//alert("last visit timestamp updated");
	}, function(error)
	{
		alert(error);
	});
}

/*
The chat window is closed and the messages gallery will be made visible again.
*/
$("#close_chat").on("click", function()
{
	$('#chat-container').fadeOut(500, function() {
		$('#search-header').fadeIn(500);
		$('#profile_images_container').fadeIn(500);
	});
	
	var recipientUID = $("#send_chat").data().uid;
						
	firebase.database().ref('inboxes/' + loggedInUID).child(recipientUID).off();
});

/*
The message is sent to the intended recipient and is displayed within the chat windowin real time.
*/
$("#send_chat").on("click", function()
{
	prepareChatMessage();
});

//an event handler in response to the 'enter' key being pressed.
$('#chat_input').keypress(function(event){
    var keycode = (event.keyCode ? event.keyCode : event.which);
    if(keycode == '13'){
        prepareChatMessage();
    }
});

/*
retrieves chat input and sends it to Firebase.
input area is cleared.
A listener is prepared within the 'prepareContextMenu' function for listening for chat messages.
*/
function prepareChatMessage()
{
	var message = $("#chat_input").val();
	
	if(message !== '')
	{
		var recipientUID = $( "#send_chat" ).data().uid;
		
		$("#chat_input").val('');
		adjustChatWindow();
		sendChatMessage(recipientUID, message);
	}
}










/*
the header at the top of the page will be configured to reflect that the user is currently logged in.
The 'messages', 'profile', and 'logout' buttons will be visible.
*/
function showLoggedInHeader()
{
	$("#login-logout-interface").html("<a class='logo' href='/'><img alt='logo' width='200' src='images/logo.png'/></a><nav class='nav font-gotham-medium'><ul class='user-links list-inline pull-right'><li><a id='messages' class='header-link-signup text-uppercase nav-link'>Messages</a></li><li><a id='profile' class='header-link-signup text-uppercase nav-link'>Profile</a></li><li><a id='logout' class='text-uppercase nav-link'>Logout</a></li></ul></nav>");
	
	configureMessagesButton(); //loads the conversations that this user is currently engaged in.
	configureProfileButton(); //loads the profile management modal window.
	configureLogoutButton(); //logs the user out.
}

/*
When the user clicks the 'messages' button, their list of conversations is retrieved from the database.
The conversations are identified by the Firebase UID of the user that they are conversing with.
For each for these UIDs, the owner's profile image is retrieved. The profile image file name is also the UID.
A div with a spinner will act as a placeholder while the image is being retrieved. It will be replaced by an img.
A context menu is attached. It will allow the user to open the conversation, view the profile of the user they are 
conversing with, or remove the conversation.
*/
function configureMessagesButton()
{
	$("#messages").on("click", function()
	{
		$('#profile_images_container-inner').html(new Spinner({color: "#000", top: "50%", left: "50%"}).spin().el);
		
		firebase.database().ref('inboxes/' + loggedInUID + '/conversations').once("value", function(snapshot)
		{
			$('#profile_images_container-inner').html('');
			
			snapshot.forEach(function(data)
			{
				$('<div />', { id: data.key, class: "profile_image", style: "position: relative;" }).appendTo($('#profile_images_container-inner'));
				$('#' + data.key).html(new Spinner({color: "#000", top: "50%", left: "50%"}).spin().el);
				
				firebase.storage().ref().child('profileimages/' + data.key).getDownloadURL().then(function(profile_image_url)
				{
					prepareContextMenu(data, profile_image_url);
				}, function(error)
				{
					$('#' + data.key).remove();
				});
			});
			
			function prepareContextMenu(data, profile_image_url)
			{
				$("#" + data.key).replaceWith('<img id=' + data.key + ' alt="profile image" class=profile_image src=' + profile_image_url + '/>');
					
				$(function()
				{
					$.contextMenu({
						selector: "#" + data.key, 
						trigger: 'left',
						callback: function(key, options)
						{
							if(key === 'open_chat')
							{
								var recipientUID = data.key;
							
								$("#send_chat").data().uid = recipientUID;
								
								$('#chat_messages').html('');
								
								//firebase.database().ref('inboxes/' + loggedInUID).child(recipientUID).off();
								
								/*
								When chat is opened, we retrieve all messages. This will also set a listener for any
								new messages. By inspecting the uid of the message, we can determine which user sent
								it and display it in the chat window accordingly.
								*/
								firebase.database().ref('inboxes/' + loggedInUID).child(recipientUID).on('child_added', function(snapshot)
								{
									if(loggedInUID == snapshot.val().uid)
										$('#chat_messages').append('<div class="row msg_container base_receive"><div class="col-md-2 col-xs-2 avatar"><img src=' + firebase.auth().currentUser.photoURL + ' alt="profile image" class="img-responsive profile_image2" onload="scrollBottom()"/></div><div class="col-md-10 col-xs-10"><div class="messages msg_receive"><p>' + snapshot.val().message + '</p></div></div></div>');
									else
										$('#chat_messages').append('<div class="row msg_container base_sent"><div class="col-md-10 col-xs-10 "><div class="messages msg_sent"><p>' + snapshot.val().message + '</p></div></div><div class="col-md-2 col-xs-2 avatar"><img src=' + profile_image_url + ' alt="profile image" class="img-responsive profile_image2" onload="scrollBottom()"/></div></div>');
								});
								
								$('#search-header').fadeOut(500);
								$('#profile_images_container').fadeOut(500, function() {
									$('#chat-container').fadeIn(500);
									adjustChatWindow();
								});
							}
							else if(key === 'view_profile')
							{
								firebase.database().ref('profiles').child(data.key).on('value', function(snapshot)
								{
									var age = snapshot.val().age;
									var height = snapshot.val().height;
									var major = snapshot.val().major;
									var university = snapshot.val().university;
									var about = snapshot.val().about;

									showProfileModal(age, height, major, university, about, data.key, profile_image_url, false);
								});
							}
							else if(key === 'remove_chat')
							{
								firebase.database().ref('inboxes/' + loggedInUID + '/conversations').child(data.key).remove()
								.then(function()
								{
									firebase.database().ref('inboxes/' + loggedInUID).child(data.key).remove()
									.then(function()
									{
										$("#" + data.key).remove();
									}, function(error)
									{
										alert(error);
									});
								
								}, function(error)
								{
									alert(error);
								});
							}
						},
						items: {
							'open_chat': {name: 'Open Chat', icon: 'edit'},
							'view_profile': {name: 'View Profile', icon: 'loading'},
							'sep1': "---------",
							'remove_chat': {name: 'Remove', icon: 'delete'}
						}
					});
				});
			}
		});
	});
}

function configureProfileButton()
{
	var canvas;
	var isNewProfile;
	$("#profile").on("click", function()
	{
		canvas = null;
		isNewProfile = true;
	
		$('#modal-popup-container-inner').html('');
		
		$('#modal-popup-container-inner').append('<div class="modal-header"><span class="close">&times;</span><h2>Your Profile</h2></div>');
		$(".close").on("click", function() {
			closeCurrentPopup();
		});
		
		$('#modal-popup-container-inner').append('<div id="modal-body-container" class="modal-body"><div id="profile_image_container" style="text-align: center; position: relative; height: 250px;"><img id="destination_profile_image" alt="profile image" style="visibility: hidden;"/><img id="source_profile_image" alt="profile image"/>&nbsp;<img id="rotateProfileImage" style="display: none; cursor: pointer;" src="images/rotate.png"/><input id="profile_image" name="file" type="file"></div><div><div class="profile-input-container"><select id="profile_gender" class="profile-input-element"><option value="" disabled selected>I am...</option><option value="male">Male</option><option value="female">Female</option></select></div><div class="profile-input-container"><select id="profile_seeking" class="profile-input-element"><option value="" disabled selected>Seeking...</option><option value="male">Male</option><option value="female">Female</option></select></div><div class="profile-input-container"><select id="profile_age" class="profile-input-element"><option value="" disabled selected>Age</option><option value="18">18</option><option value="19">19</option><option value="20">20</option><option value="21">21</option><option value="22">22</option><option value="23">23</option><option value="24">24</option><option value="25">25</option><option value="26">26</option><option value="27">27</option><option value="28">28</option><option value="29">29</option><option value="30">30</option><option value="31">31</option><option value="32">32</option><option value="33">33</option><option value="34">34</option><option value="35">35</option></select></div><div class="profile-input-container"><select id="profile_height" class="profile-input-element"><option value="" disabled selected>Height</option><option value="< 5&apos;">< 5&apos;</option><option value="5&apos;0&quot;">5&apos;0&quot;</option><option value="5&apos;1&quot;">5&apos;1&quot;</option><option value="5&apos;2&quot;">5&apos;2&quot;</option><option value="5&apos;3&quot;">5&apos;3&quot;</option><option value="5&apos;4&quot;">5&apos;4&quot;</option><option value="5&apos;5&quot;">5&apos;5&quot;</option><option value="5&apos;6&quot;">5&apos;6&quot;</option><option value="5&apos;7&quot;">5&apos;7&quot;</option><option value="5&apos;8&quot;">5&apos;8&quot;</option><option value="5&apos;9&quot;">5&apos;9&quot;</option><option value="5&apos;10&quot;">5&apos;10&quot;</option><option value="5&apos;11&quot;">5&apos;11&quot;</option><option value="6&apos;0&quot;">6&apos;0&quot;</option><option value="6&apos;1&quot;">6&apos;1&quot;</option><option value="6&apos;2&quot;">6&apos;2&quot;</option><option value="6&apos;3&quot;">6&apos;3&quot;</option><option value="6&apos;4&quot;">6&apos;4&quot;</option><option value="6&apos;5&quot;">6&apos;5&quot;</option><option value="6&apos;6&quot;">6&apos;6&quot;</option><option value="6&apos;7&quot;">6&apos;7&quot;</option><option value="6&apos;8&quot;">6&apos;8&quot;</option><option value="6&apos;9&quot;">6&apos;9&quot;</option><option value="6&apos;10&quot;">6&apos;10&quot;</option><option value="6&apos;11&quot;">6&apos;11&quot;</option><option value="7&apos;0&quot;">7&apos;0&quot;</option><option value="> 7&apos;">> 7&apos;</option></select></div><div class="profile-input-container"><select id="profile_university" class="profile-input-element"><option value="" disabled selected>Select Your University</option><option value="University of California Berkeley">University of California Berkeley</option><option value="University of California Davis">University of California Davis</option><option value="University of California Irvine">University of California Irvine</option><option value="University of California Los Angeles">University of California Los Angeles</option><option value="University of California Merced">University of California Merced</option><option value="University of California Riverside">University of California Riverside</option><option value="University of California San Diego">University of California San Diego</option><option value="University of California San Francisco">University of California San Francisco</option><option value="University of California Santa Barbara">University of California Santa Barbara</option><option value="University of California Santa Cruz">University of California Santa Cruz</option></select></div><div class="profile-input-container"><input id="profile_major" placeholder="Your Major" class="profile-input-element"></div><div class="profile-input-container"><textarea id="profile_about" placeholder="Tell us a bit about yourself!" class="profile-input-element"></textarea></div></div></div>');
		
		$('#profile_image_container').prepend(new Spinner({color: "#000", top: "50%", left: "50%"}).spin().el);
		
		/*
		The user's profile image and data are retrieved. The modal popup is then populated with this data.
		*/
		firebase.database().ref('profiles').child(loggedInUID).once("value").then(function(snapshot)
		{
			if(snapshot.val() != null)
			{
				firebase.storage().ref('profileimages').child(loggedInUID).getDownloadURL().then(function(profile_image_url)
				{
					isNewProfile = false;
					showProfileImage(profile_image_url);
				}, function(error)
				{
					if(error.code === 'storage/object-not-found')
					{
						isNewProfile = true;
						showProfileImage("images/profile_image.png");
					}
					else
						alert(error);
				});
				
				function showProfileImage(url)
				{
					$('#profile_image_container').find('div').first().remove();
					
					$('#destination_profile_image').css({visibility: ''});
					$("#destination_profile_image").attr("src", url);
					
					$("#destination_profile_image").on("click", function() {
						$('#profile_image').trigger('click');
					});
				}
				
				var gender = snapshot.val().gender;
				var seeking = snapshot.val().seeking;
				var age = snapshot.val().age;
				var height = snapshot.val().height;
				var university = snapshot.val().university;
				var major = snapshot.val().major;
				var about = snapshot.val().about;

				$("#profile_gender").val(gender).change();
				$("#profile_seeking").val(seeking).change();
				$("#profile_age").val(age).change();
				$("#profile_height").val(height).change();
				$("#profile_university").val(university).change();
				$("#profile_major").val(major);
				$("#profile_about").val(about);
			}
			else {
				isNewProfile = true;
			}
		}, function(error)
		{
			alert(error);
		});
		
		
		/*
		When the user selects an image from their file system, this listener will prepare it and display it
		for the user to see. profile images consist of a square that is center-cropped from the source image, 
		the dimensions of which will be based on the smaller width or height dimension of the source image. 
		*/
		$('#profile_image').change(function()
		{
			var file = document.getElementById("profile_image").files[0];
			var source_profile_image = document.getElementById("source_profile_image");
			var destination_profile_image = document.getElementById("destination_profile_image");
			
			source_profile_image.src = window.URL.createObjectURL(file);
			source_profile_image.onload = function()
			{
				var minimumDimension, widthTrim, heightTrim;
				var FINAL_SIZE = 250;
				
				if(source_profile_image.height < source_profile_image.width)
				{
					minimumDimension = source_profile_image.height;
					widthTrim = (source_profile_image.width / 2) - (source_profile_image.height / 2);
					heightTrim = 0;
				}
				else
				{
					minimumDimension = source_profile_image.width
					widthTrim = 0;
					heightTrim = (source_profile_image.height / 2) - (source_profile_image.width / 2);
				}
				
				canvas = document.createElement("canvas");
				canvas.width  = FINAL_SIZE;
				canvas.height = FINAL_SIZE;
				var ctx = canvas.getContext("2d");
				ctx.drawImage(source_profile_image, widthTrim, heightTrim, minimumDimension, minimumDimension, 0, 0, FINAL_SIZE, FINAL_SIZE);
				
				destination_profile_image.src = canvas.toDataURL();
				ctx.restore();
				
				/*
				the rotate button is displayed so that the user can set the orientation of their profile image.
				*/
				$("#rotateProfileImage").css({display: ''});
				$("#rotateProfileImage").on("click", function() {
					ctx.clearRect(0, 0, canvas.width, canvas.height);
					ctx.save();
					ctx.translate(canvas.width / 2, canvas.height / 2);
					ctx.rotate(90 * Math.PI / 180);
					ctx.drawImage(destination_profile_image, -destination_profile_image.width / 2, -destination_profile_image.width / 2);
					ctx.restore();
					
					destination_profile_image.src = canvas.toDataURL();
				});
			}
		});
		
		$('#modal-popup-container-inner').append('<div class="modal-footer" style="text-align: center;"><button id="profile_submit">Update Profile</button></div>');
		$('#modal-popup-container-inner').attr('class', 'modal-content modal-content-top-animation');
		$('#modal-popup-container').css({'display': 'block'});
		
		/*
		The user is submitting the changes made to their profile.
		*/
		$("#profile_submit").on("click", function()
		{
			if(canvas == null && isNewProfile)  //the user is creating a new profile but didn't select an image
			{
				alert("You must upload an image");
			}
			else if(canvas == null && !isNewProfile) //not a new profile and they aren't updating their image
			{
				if(isProfileTextDataComplete())
					uploadProfileData(getProfileTextData(false), null);
				else
					alert("Please fill out all info within your profile.");
			}
			else if(canvas != null && isNewProfile || canvas != null && !isNewProfile) //a new profile and they are uploading an image, or the profile exists and uploading an image
			{
				var destination_profile_image = document.getElementById("destination_profile_image");
				
				blobUtil.imgSrcToBlob(destination_profile_image.src, 'image/jpeg', 'Anonymous', 0.5).then(function (imageData)
				{
					if(imageData == null)
						alert("nothing here");
					else
					{
						if(isProfileTextDataComplete())
							uploadProfileData(getProfileTextData(isNewProfile), imageData);
						else
							alert("Please fill out all info within your profile.");
					}
				}).catch(function (err) {
					alert(err);
				});
				
				/*
				canvas.toBlob(function(imageData)
				{
					if(imageData == null)
						alert("nothing here");
					else
					{
						uploadProfileData(getProfileTextData(isNewProfile), imageData);
					}
				}, 'image/jpeg');
				*/
			}
			
			/*
			The user's profile is uploaded to the Firebase backend.
			*/
			function uploadProfileData(textData, imageData)
			{
				$("#profile_submit").text('...please wait...');
				$('#profile_submit').prop("disabled", true);
				
				//uploading profile text data
				firebase.database().ref('profiles/' + loggedInUID).update(textData).then(function()
				{
					//alert("profile text updated");
					
					//uploading profile image
					if(imageData != null)
					{
						firebase.storage().ref().child('profileimages/' + loggedInUID).put(imageData).then(function(snapshot)
						{
							firebase.auth().currentUser.updateProfile({photoURL: snapshot.downloadURL});
							markProfileActive();
							closeCurrentPopup();
							//alert("profile updated, with image: " + snapshot.downloadURL);
						}, function(error)
						{
							alert(error);
						});
					}
					else
					{
						markProfileActive();
						closeCurrentPopup();
					}
				}, function(error)
				{
					alert(error);
				});
				
				
				
				function markProfileActive()
				{
					firebase.database().ref('profiles/' + loggedInUID).update({ hasProfile: true }).then(function()
					{
						//alert("profile text updated");
						hasProfile = true;
					}, function(error)
					{
						alert(error);
					});
				}
			}
			
			function isProfileTextDataComplete()
			{
				var gender = $("#profile_gender").val();
				var seeking = $("#profile_seeking").val();
				var age = $("#profile_age").val();
				var height = $("#profile_height").val();
				var university = $("#profile_university").val();
				var major = $("#profile_major").val();
				var about = $("#profile_about").val();
				
				if(gender == null || seeking == null || age == null || height == null || university == null || major == null || about == null)
					return false;
				else
					return true;
			}
			
			function getProfileTextData(isNewProfile)
			{
				var profileData = {
					gender: $("#profile_gender").val(),
					seeking: $("#profile_seeking").val(),
					age: $("#profile_age").val(),
					height: $("#profile_height").val(),
					university: $("#profile_university").val(),
					major: $("#profile_major").val(),
					about: $("#profile_about").val()
				};
			
				if(isNewProfile)
					profileData.creationTimestamp = Date.now();
				
				return profileData;
			}
		});
	});
}

function configureLogoutButton()
{
	$("#logout").on("click", function()
	{
		firebase.auth().signOut().then(function()
		{
			
		}, function(error)
		{
		
		});
	});
}




















/*
the header at the top of the page will be configured to reflect that the user is not logged in.
The 'signup' and 'login' buttons will be visible.
*/
function showLoggedOutHeader()
{
	$("#login-logout-interface").html("<a class='logo' href='/'><img alt='logo' width='200' src='images/logo.png'/></a><nav class='nav font-gotham-medium'><ul class='user-links list-inline pull-right'><li><a id='signup' class='header-link-signup text-uppercase nav-link'>Sign up</a></li><li><a id='login' class='text-uppercase nav-link'>Login</a></li></ul></nav>");
	
	configureSignupButton();
	configureLoginButton();
}

function configureSignupButton()
{
	$("#signup").on("click", function()
	{
		$('#modal-popup-container-inner').html('');
		
		$('#modal-popup-container-inner').append('<div class="modal-header"><span class="close">&times;</span><h2>Sign Up</h2></div>');
		$(".close").on("click", function() {
			closeCurrentPopup();
		});
		
		$('#modal-popup-container-inner').append('<div id="modal-body-container" class="modal-body" style="text-align: center;"><div style="display: inline-block; width: 60%;"><br><input id="signup-email" placeholder="email" type="text" style="width: 100%; box-sizing : border-box;"><br><input id="signup-password" placeholder="password" type="text" style="width: 100%; box-sizing : border-box;"><div><br><button id="signup-submit">submit</button><br><br></div></div></div>');
		
		$('#modal-popup-container-inner').append('<div class="modal-footer"><br></div>');
		
		$("#signup-submit").on("click", function()
		{
			var email = $("#signup-email").val();
			var password = $("#signup-password").val();
			
			firebase.auth().createUserWithEmailAndPassword(email, password).then(function(user)
			{
				//the user is automatically signed in, causing the onAuthStateChanged listener at the top of this file to be called.
			}, function(error)
			{
				alert(error.message);
			});
		});
		
		$('#modal-popup-container-inner').attr('class', 'modal-content modal-content-top-animation');
		$('#modal-popup-container').css({'display': 'block'});
	});
}

function configureLoginButton()
{
	$("#login").on("click", function()
	{
		$('#modal-popup-container-inner').html('');
		
		$('#modal-popup-container-inner').append('<div class="modal-header"><span class="close">&times;</span><h2>Log In</h2></div>');
		$(".close").on("click", function() {
			closeCurrentPopup();
		});
		
		$('#modal-popup-container-inner').append('<div id="modal-body-container" class="modal-body" style="text-align: center;"><div id="login-container" style="display: inline-block; width: 60%;"><br><input id="login-email" placeholder="email" type="text" style="width: 100%; box-sizing : border-box;"><br><input id="login-password" placeholder="password" type="text" style="width: 100%; box-sizing : border-box;"><div><br><button id="login-forgot">forgot password</button>&nbsp;&nbsp;&nbsp;<button id="login-submit">submit</button><br><br><button onclick="googleSignIn()">Sign in with Google</button></div></div></div>');
		
		$("#login-forgot").on("click", function()
		{
			$('#login-container').html('<br><input id="forgot-email" placeholder="email" type="text" style="width: 100%; box-sizing : border-box;"><br><div><br><button id="forgot-submit">submit</button><br><br></div>');
			
			$("#forgot-submit").on("click", function()
			{
				var email = $("#forgot-email").val();
				$(this).prop("disabled", true);
				
				firebase.auth().sendPasswordResetEmail(email).then(function()
				{
					closeCurrentPopup();
					alert("An email has been sent with password reset instructions.");
					
				}, function(error)
				{
					$(this).prop("disabled", false);
					
					if(error.code === 'auth/user-not-found')
						alert("An account was not found with that email.");
					else
						alert(error.message);
				});
			});
		});
		
		$("#login-submit").on("click", function()
		{							
			var email = $("#login-email").val();
			var password = $("#login-password").val();
			
			firebase.auth().signInWithEmailAndPassword(email, password).then(function(user)
			{
				//The onAuthStateChanged listener at the top of this file will be called.
			}, function(error)
			{
				alert(error);
			});
		});
		
		$('#modal-popup-container-inner').append('<div class="modal-footer"><br></div>');
		$('#modal-popup-container-inner').attr('class', 'modal-content modal-content-top-animation');
		$('#modal-popup-container').css({'display': 'block'});
	});
}






















/*
A search is performed with the parameters that the user has chosen.
*/
$("#search").on("click", function()
{
	var search_gender = $("#search_gender").val();
	var search_seeking = $("#search_seeking").val();
	var search_university = $("#search_university").val();
	var search_sort = $("#search_sort").val();
	
	if(search_gender == null || search_seeking == null || search_university == null)
		alert('Please specify your search terms.');
	else
	{
		$.contextMenu('destroy');
		
		performSearch(search_gender, search_seeking, search_university, search_sort);
	}
});

/*
Search implementation.
The profile images must be displayed in descending order based on the sort method chosen.
	The search results will be returned with time stamps in no particular order, and Firebase does not support multiple orderBy queries.
A forEach loop will iterate through the returned results and perform a sorted insert into an array.
Only profiles shown are those that have a profile image, is not the logged in user, and matches the search parameters.
If no results, then inform the user than there are no results found.
If results, then create a placeholder div with a spinner loading indicator for each profile image.
Once the URL for the image has been retrieved from Firebase, replace the corresponding div with an img with the URL as the src attritube.
	Div can be given dimensions, but img will not have dimensions until a src has been set, hence the placeholder approach.
*/
function performSearch(search_gender, search_seeking, search_university, search_sort)
{
	$('#profile_images_container-inner').html(new Spinner({color: "#000", top: "50%", left: "50%"}).spin().el);
	
	firebase.database().ref('profiles').orderByChild("university").equalTo(search_university).once("value").then(function(snapshot)
	{
		var profilesArray = [];
		
		/*
		iterate through the results and only retrieve profiles that match the search parameters.
		the user will not appear within their own search results.
		*/
		snapshot.forEach(function(data)
		{
			if(data.val().hasProfile && loggedInUID !== data.key && search_gender === data.val().seeking && search_seeking === data.val().gender)
			{
				var profile = {
					uid: data.key,
					age: data.val().age,
					height: data.val().height,
					major: data.val().major,
					about: data.val().about
				};
				
				if(search_sort === 'sort_last')
					profile.timestamp = data.val().lastVisitTimestamp;
				else if(search_sort === 'sort_newest')
					profile.timestamp = data.val().creationTimestamp;
				
				insertProfile(profile, profilesArray);
			}
		});
		
		//the array of valid search results is constructed
		function insertProfile(profile, profilesArray) {
			if(profilesArray.length == 0)
				profilesArray.push(profile);
			else
				profilesArray.splice(locationOf(profile, profilesArray) + 1, 0, profile);
			
			return profilesArray;
		}

		//sorted insert, descending order based on timestamp
		function locationOf(profile, profilesArray, start, end) {
			start = start || 0;
			end = end || profilesArray.length;
			var pivot = parseInt(start + (end - start) / 2, 10);
			
			if (profilesArray[pivot].timestamp === profile.timestamp)
				return pivot;
				
			if (end - start <= 1)
				return profilesArray[pivot].timestamp < profile.timestamp ? pivot - 1 : pivot;
				
			if (profilesArray[pivot].timestamp > profile.timestamp)
				return locationOf(profile, profilesArray, pivot, end);
			else
				return locationOf(profile, profilesArray, start, pivot);
		}
		
		//if the array is empty, then search results are empty
		if(profilesArray.length == 0)
			$('#profile_images_container-inner').html('<h1>No results found.</h1>');
		else
		{
			$('#profile_images_container-inner').html('');
			
			//otherwise, iterate through the array of search results
			profilesArray.forEach(function(profile)
			{
				var uid = profile.uid;
				var age = profile.age;
				var height = profile.height;
				var major = profile.major;
				var about = profile.about;
				
				/*
				a div with a centered spinner will indicate that a profile image is loading
				once the url for this profile's image has been retrieved, the div will be replaced with a img
				if error, the div is removed
				*/
				$('<div />', { id: uid, class: "profile_image", style: "position: relative;" }).appendTo($('#profile_images_container-inner'));
				$('#' + uid).html(new Spinner({color: "#000", top: "50%", left: "50%"}).spin().el);
				
				firebase.storage().ref().child('profileimages/' + uid).getDownloadURL().then(function(profile_image_url)
				{
					$("#" + uid).replaceWith('<img id=' + uid + ' alt="profile image" class=profile_image src=' + profile_image_url + '/>');
					$("#" + uid).on("click", function()
					{
						showProfileModal(age, height, major, null, about, this.id, this.src, true);
					});
				}, function(error)
				{
					$("#" + uid).remove();
					//alert(error);
				});
			});
		}
	},function(error)
	{
		alert(error);
	});
}




/*
The modal for a profile. Contains all info for that profile.
The modal is configured depending on if it is being displayed from search results or from the user's messages.
Search results modal will show the message sending box for sending an initial message.
Messages modal will not show this initial message input area because a conversation is already taking place.
*/
function showProfileModal(age, height, major, university, about, recipientUID, src, showSendMessage)
{
	$('#modal-popup-container-inner').html('');
	
	if(showSendMessage)
	{
		$('#modal-popup-container-inner').append('<div class="modal-header"><span class="close">&times;</span><h2>Contact them!</h2></div>');
		
		if(university == null)
			$('#modal-popup-container-inner').append('<div class="modal-body" style="text-align: center;"><div style="text-align: center;"><div id="profile_image_container" style="position: relative; width: 100%; height: 250px;"><img id="profile_image_inner" alt="profile image"/></div><div style="width: 100%;"><b>Age: </b>' + age + '<br><b>Height: </b>' + height + '<br><b>Major: </b>' + major + '<br><b>About: </b>' + about + '</p></div></div></div>');
		else
			$('#modal-popup-container-inner').append('<div class="modal-body" style="text-align: center;"><div style="text-align: center;"><div id="profile_image_container" style="position: relative; width: 100%; height: 250px;"><img id="profile_image_inner" alt="profile image"/></div><div style="width: 100%;"><b>Age: </b>' + age + '<br><b>Height: </b>' + height + '<br><b>Major: </b>' + major + '<br><b>University: </b>' + university + '<br><b>About: </b>' + about + '</p></div></div></div>');
		
		
		if(loggedInUID == null)
		{
			$('#modal-popup-container-inner').append('<div class="modal-footer" style="text-align: center;"><div><textarea id="message-input" placeholder="Want to contact them? Enter your message here!"></textarea><button disabled>Log in to Send Messages!</button></div></div>');
		}
		else if(!hasProfile)
		{
			$('#modal-popup-container-inner').append('<div class="modal-footer" style="text-align: center;"><div><textarea id="message-input" placeholder="Want to contact them? Enter your message here!"></textarea><button disabled>Create a Profile to Send Messages!</button></div></div>');
		}
		else
		{
			$('#modal-popup-container-inner').append('<div class="modal-footer" style="text-align: center;"><div><textarea id="message-input" placeholder="Want to contact them? Enter your message here!"></textarea><button id="send_message">Send Message!</button></div></div>');
			
			$("#send_message").on("click", function()
			{
				var message = $("#message-input").val();
				
				if(message == '')
					alert("Messages cannot be blank.");
				else
				{
					sendChatMessage(recipientUID, message);
					closeCurrentPopup();
				}
			});
		}
	}
	else
	{
		$('#modal-popup-container-inner').append('<div class="modal-header"><span class="close">&times;</span><h2>Profile</h2></div>');
		
		if(university == null)
			$('#modal-popup-container-inner').append('<div class="modal-body" style="text-align: center;"><div style="text-align: center;"><div id="profile_image_container" style="position: relative; width: 100%; height: 250px;"><img id="profile_image_inner" alt="profile image"/></div><div style="width: 100%;"><b>Age: </b>' + age + '<br><b>Height: </b>' + height + '<br><b>Major: </b>' + major + '<br><b>About: </b>' + about + '</p></div></div></div>');
		else
			$('#modal-popup-container-inner').append('<div class="modal-body" style="text-align: center;"><div style="text-align: center;"><div id="profile_image_container" style="position: relative; width: 100%; height: 250px;"><img id="profile_image_inner" alt="profile image"/></div><div style="width: 100%;"><b>Age: </b>' + age + '<br><b>Height: </b>' + height + '<br><b>Major: </b>' + major + '<br><b>University: </b>' + university + '<br><b>About: </b>' + about + '</p></div></div></div>');
		
		$('#modal-popup-container-inner').append('<div class="modal-footer" style="text-align: center;"><br></div>');
	}
	
	$('#profile_image_inner').attr('src', src);
	
	$(".close").on("click", function() {
		closeCurrentPopup();
	});
	
	$('#modal-popup-container-inner').attr('class', 'modal-content modal-content-center-animation');
	$('#modal-popup-container').css({'display': 'block'});
}

/*
Sends a message to the sender and the recipient.
This function is used for the initial message and for actively chatting with a user.
*/
function sendChatMessage(recipientUID, message)
{
	//add the recipient to the sender's list of conversations
	firebase.database().ref('inboxes/' + loggedInUID + '/conversations').once("value", function(snapshot)
	{
		if (!snapshot.hasChild(recipientUID))
		{
			firebase.database().ref('inboxes/' + loggedInUID + '/conversations').child(recipientUID).set(true)
			.then(function()
			{
			
			}, function(error)
			{
				alert(error);
			});
		}
	});
	
	//add the sender to the recipient's list of conversations
	firebase.database().ref('inboxes/' + recipientUID + '/conversations').once("value", function(snapshot)
	{
		if (!snapshot.hasChild(loggedInUID))
		{
			firebase.database().ref('inboxes/' + recipientUID + '/conversations').child(loggedInUID).set(true)
			.then(function()
			{
			
			}, function(error)
			{
				alert(error);
			});
		}
	});
	
	
	var timestamp = Date.now();
	
	//the sender will have the message recorded within their inbox for this conversation
	firebase.database().ref('inboxes/' + loggedInUID + '/' + recipientUID).child(timestamp).set({uid: loggedInUID, message: message, timestamp: timestamp})
	.then(function()
	{
		
	}, function(error)
	{
		alert(error);
	});
	
	//the recipient will have the message recorded within their inbox for this conversation
	firebase.database().ref('inboxes/' + recipientUID + '/' + loggedInUID).child(timestamp).set({uid: loggedInUID, message: message, timestamp: timestamp})
	.then(function()
	{
		
	}, function(error)
	{
		alert(error);
	});
}



/*
On page load, this function will retrieve the top 50 profiles.
The results of the query are returned by Firebase in ascending order. The most recent
visitor will be at the end of the results.
JQuery will prepend the profile images within the gallery so that they will load
in descending order; the most recent visitor appears first.
*/
function showTop50Profiles()
{
	$('#profile_images_container-inner').html(new Spinner({color: "#000", top: "50%", left: "50%"}).spin().el);
	
	firebase.database().ref('profiles').orderByChild("lastVisitTimestamp").limitToFirst(50).once("value").then(function(snapshot)
	{
		$('#profile_images_container-inner').html('');
		
		snapshot.forEach(function(data)
		{
			var uid = data.key;
			var age = data.val().age;
			var height = data.val().height;
			var major = data.val().major;
			var university = data.val().university;
			var about = data.val().about;
			
			if(data.val().hasProfile)
			{
				$('<div />', { id: uid, class: "profile_image", style: "position: relative;" }).prependTo($('#profile_images_container-inner'));
				$('#' + uid).html(new Spinner({color: "#000", top: "50%", left: "50%"}).spin().el);
				
				firebase.storage().ref().child('profileimages/' + uid).getDownloadURL().then(function(profile_image_url)
				{
					$("#" + uid).replaceWith('<img id=' + uid + ' alt="profile image" class=profile_image src=' + profile_image_url + '/>');
					$("#" + uid).on("click", function()
					{
						showProfileModal(age, height, major, university, about, this.id, this.src, true);
					});
				}, function(error)
				{
					$("#" + uid).remove();
				});
			}
		});
	}, function(error)
	{
		alert(error);
	});
}





//a helper function for closing the currently visible modal popup
function closeCurrentPopup()
{
	$('.modal-popup').css({'display': 'none'});
}

//if a modal popup is visible, clicking on the background around it will close it
$(window).on("click", function(event) {
	if (event.target == $('.modal-popup')[0]) {
		closeCurrentPopup();
	}
});


/*
The following code is responsible for resizing the chat box if the window is resized.
It will also scroll the chat box to the bottom, showing the most recent message.
*/
var chat_container_inner = $('#chat-container-inner');
function scrollBottom() {
	chat_container_inner.scrollTop(chat_container_inner.prop("scrollHeight"));
}
function resizeDiv() {
	chat_container_inner.height($(window).height() - $('#account-header').height() - $('#message-input-container').height() - 2);
};
function adjustChatWindow()	{
	resizeDiv();
	scrollBottom();
}
$(window).ready(function () {
	adjustChatWindow();
});
$(window).bind("resize", function () {
	adjustChatWindow();
});


//onAuthStateChanged at the top of this file will be called on successful login.
function googleSignIn()
{
	var provider = new firebase.auth.GoogleAuthProvider();
	firebase.auth().signInWithPopup(provider).then(function(result)
	{
		// This gives you a Google Access Token. You can use it to access the Google API.
		var token = result.credential.accessToken;
		// The signed-in user info.
		var user = result.user;
	}).catch(function(error)
	{
		// Handle Errors here.
		var errorCode = error.code;
		var errorMessage = error.message;
		// The email of the user's account used.
		var email = error.email;
		// The firebase.auth.AuthCredential type that was used.
		var credential = error.credential;
		
		alert(errorMessage);
	});
}



