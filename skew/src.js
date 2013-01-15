define([
	"dojo/NodeList-FX",
	"dojo/_base/fx",
	"dojo/fx/easing",
	"dijit/_WidgetBase",
	"dojox/analytics/Urchin",
	"dojox/layout/RadioGroup",
	"dojox/widget/Dialog",
	"demos/skew/src/Image",
	"dojo/dom-style",
	"dojo/query",
	"dojo/_base/array",
	"dojo/on",
	"dojo/dom",
	"dojo/request",
	"dojo/_base/lang",
	"dojo/_base/window",
	"dijit/layout/ContentPane",
	"dojo/dom-construct",
	"dojo/has",
	"dojo/_base/declare",
	"dojo/ready",
	"dojo/NodeList-dom"
], function (NodeListFX, baseFx, easing, _WidgetBase, analyticsUrchin, RadioGroup, widgetDialog, skewSrcImage, domStyle, query, arrayUtil, on, dom, request, lang, win, ContentPane, domConstruct, has, declare, ready) {

	
	var _stuffMoving = false,
		_started = false,
		_stalltime = 650, // ms
		_doneAnim = null,
		_needed = null,
		_loaded = [],
		_connects = [],
		profileWidget = null,
		stack = null,
		timer = null,
		_profiletimer = null,
		_neededImages;
	
	_doneAnim = function(){
		
		baseFx.fadeOut({
			// fade out the overlay
			node: "overlay",
			duration: 300,
			onEnd: function(){
				// then make our image surface 240px, and fade it in
				baseFx.animateProperty({
					node:"imageContainer",
					properties: {
						height: 240,
						opacity:1
					},
					// with teh sexy
					easing: easing.backOut,
					duration:420,
					// wait for the fadeout above to finish
					delay:600,
					onEnd: function(){
						// hide the actual overlay so you can click underneath it
						domStyle.set("overlay","display","none");
						_started = true;
						// take all the elements with "startsHidden" class, and
						// set them up, fade them in, and remove hidden class
						query(".startsHidden")
							.style("opacity", "0")
							.removeClass("startsHidden")
							.fadeIn().play(500);
					}
				}).play();
			}
		}).play();
		
	};
	
	// onShow result, it no timer was running (see later)
	var updateProfile = function(datawidget){
		//if(!_started){ return; }
		_stuffMoving = true;
		// conveniently, later, we stored a reference to our avatar (RadioGroupSlide child)
		// in the Image widget.
		stack.selectChild(datawidget._avatar);
		profileWidget.setData(datawidget._userInfo);
	};

	var _oneBroke = function(n,e){
		_gotOne(n,e);
	};

	// the handler for our image onloader.
	// FIXME: if we get a 404, we'll never finish ...
	var _gotOne = function(n,e){
		_loaded.push(n);
		if(_loaded.length >= _neededImages){
			arrayUtil.forEach(_connects, function (handle) {
				handle.remove();
			});
			_doneAnim();
		}
	};

	// the onLoad function
	var init = function(){
	
		// tracking demo:
		var u = new analyticsUrchin({
			acct: "UA-3572741-1",
			GAonLoad: function(){
				this.trackPageView("/demos/skew");
			}
		});
	
		domStyle.set("whoNode","opacity", 0);
	
		// see, the page "degrades" ;) . This contributor listing page is only a link to
		// http://dojo.jot.com/ContrbutorListing
		query("a[id^=dojojot]").forEach(function(n){
			n.parentNode.innerHTML = n.innerHTML;
		});
	
		// create a "help" dialog out of the node in the page.
		var dialog = new widgetDialog({
			dimensions:[640,420]
		},"dialog");
		dialog.startup();
		// setup a way to show it
		on(dom.byId("helper"), "click", dialog, "show");
	
		// set it all off: grab some data from a remote file, and create
		// the interface
		request("../resources/users.json", {
			handleAs:"json"
		}).then(function (data) {
			
			var labelNode = dom.byId("whoNode");
			var _lastNode = null;
			
			profileWidget = new profile.Data({},"profileData");
		
			// create the region where the avatars will live.
			stack = new dojox.layout.RadioGroupSlide({
				style:"width:180px; height:200px",
				// FIXME: when did StackContainer start setting relative explicitly?
				_setupChild: function(/*dijit._Widget*/ page){
					domStyle.set(page.domNode, {
						display:"none",
						position:"absolute",
						overflow:"hidden"
					});
					return page; // dijit._Widget
				}
			},"stack");
	
			// iterate over each of the returned committers, setting up the canvas
			arrayUtil.forEach(data.committers,function(user, i){
			
				// create an Image in the container, and store the user profile data
				// in it's instance.
				var im = new image.Skewed({
					// use a default square.png if no imgUrl found.
					imgUrl: user.imgUrl || "images/square.png",
					value: user.name
				});
				lang.mixin(im,{ _userInfo: user });

				// create a reflection-less scale thumbnail (color) in a div
				var node = win.doc.createElement('div');
				stack.containerNode.appendChild(node);
				node.innerHTML = "<img src='imageReflect.php?spread=0.01&thumbsize=165&src=" + im.imgUrl + "' />";
				
				// and make it a child of our RadioGroupSlide
				var avatar = new ContentPane({
					id: im.id + "avatar",
					slideFrom:"top"
				}, node);
				
				// mix a reference to the child of the stackContianer in the image widget
				lang.mixin(im, { _avatar: avatar });

				// store a ref to our "center" image
				if(i === 0){ _lastNode = im; }
				
				// either add this image to the beginning or append to the end. alternate.
				if(i % 2 == 0){
					dom.byId("imageContainer").appendChild(im.domNode);
				}else{
					domConstruct.place(im.domNode, "imageContainer", "first");
				}
			
			});
			// this will setup all the children we _just_ added
			stack.startup();
								
			// turn the container holding all the image widgets into the interface
			var ic = new image.Container({
				// for performance (it's a big list/lot of images)
				offOpacity:1,
				onShow: function(widget){
					// onShow fires _every_ time an image is "centered" visually (no skew)
					// so for UX, we'll defer the "updateProfile()" call until some delay,
					if(timer){ clearTimeout(timer); }
					timer = setTimeout(lang.partial(updateProfile, widget), _stalltime);
					// but still update one label from our widget data
					labelNode.innerHTML = widget.value + "";
					baseFx.anim("profileArea",{ opacity:0 }, 175);
				},
				// should be lower, but i want to stage opacity on the edges rather
				// than display:none, so for now this looks better.
				visibleItems: 42,
				// tweak as needed
				spacing:25,
				angle:10
			},"imageContainer");
		
			// find every image in this container, and connect an onload connect to it
			// when each image fires it's onload, the _gotOne function above is alerted
			var _needed = query("img", "imageContainer");
			_neededImages = Number(_needed.length);
			_needed.forEach(function(n,i){
				_connects.push(on(n, "load", lang.partial(_gotOne, n)));
				_connects.push(on(n, "error", lang.partial(_oneBroke, n)));
				// if you don't touch the .src attribute _after_ connecting to onload, it
				// won't fire in weird conditions.
				if(has("ie")){ n.src = n.src; }
			});
			
			ic.startup();
			_lastNode.center(); // center the first node (from above creating image widgets)
		
			// resize the image container when the window does, it's fluid
			on(window, "resize", ic, "resize");
		
			// make it small, so we can wipe it in
			domStyle.set("imageContainer",{ height:"1px", opacity:0 });
		});
	};

	declare("profile.Stalker", _WidgetBase, {
		
	});

	declare("profile.Data", _WidgetBase, {
		// summary:
		//		A simple widget we probably don't even need.
		constructor: function(){
			var byId = dom.byId;
			this.nodeReferences = {
				"location" : byId("proLocation"),
				"website"  : byId("proWebsite"),
				"employer" : byId("proEmployer"),
				"title"    : byId("proRole")
			};
		},
		
		setData: function(data){
			var node = this.nodeReferences;
			
			for(var i in node){
				if(i in data){
					domStyle.set(node[i],"display","");
					var txt = (
						i == "website" ?
							"<a href='" + data[i] + "'>" + data[i] + "</a><br>"   :
							data[i]
					);
					node[i].innerHTML = txt;
				}else{
					domStyle.set(node[i],"display","none");
				}
			}
			
			// this is really a list of potential aliases, so start clean:
			var nick = "";
			if("handle" in data){
				// add the "handle" attribute
				nick += '"' + data["handle"] + '"';
			}
			if("irc" in data && data["irc"] !== data["handle"]){
				// add the "irc" attribute, if it is different from the "handle" attribute
				nick += ' "' + data["irc"] + '"';
			}
			dom.byId("proAliases").innerHTML = nick;
			
			// fade and swipe in the content.
			// FIXME: weirdness w/ IE7 and no respecting -42 marginLegf
			baseFx.anim("profileArea",{
				opacity:{ start:0, end: 0.99 },
				paddingLeft:{ start:72, end:0 }
			}, 520, easing.bounceOut);
		}
	});

	var newp = function(){
		// IE6 branch of this demo
		window.location.href = "http://" + (confirm("Hi IE6 user! Is it 2008?") ? "webkit.org" : "mozilla.org") + "/";
	}

	// setup our branch launch: ;)
	ready((has("ie") < 7 ? newp : init));
});