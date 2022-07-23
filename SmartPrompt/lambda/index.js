/* *
 * This sample demonstrates handling intents from an Alexa skill using the Alexa Skills Kit SDK (v2).
 * Please visit https://alexa.design/cookbook for additional examples on implementing slots, dialog management,
 * session persistence, api calls, and more.
 * */
const Alexa = require('ask-sdk-core');
const Utils = require('./util.js');
const moment = require('moment-timezone');
const firebase = require('firebase/app');
require('firebase/database');
const Escape = require('lodash/escape');
const constants = require('./constants.js');

const firebaseConfig = constants.firebaseConfig;

// instantiate firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

/*
 * Helper function to retreive any piece of data from firebase
 * 
 * Note: function does not open the database for use itself, that must still be done before calling it
 */
async function getFirebaseData(path) {
    let data = null;
    await database.ref().child(path).get().then((snapshot) => {
        if (snapshot.exists()) {
            // console.log(snapshot.val());
            data = snapshot.val();
        } else {
            console.log("No data available");
        }
    }).catch((error) => {
        console.error(error);
        data = error;
    });
    return data;
}

const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    async handle(handlerInput) {
        console.log(handlerInput);
        
        // retrieve the user id
        const { userId } = handlerInput.requestEnvelope.context.System.user;
        console.log('~~~~~~~ userId: ', userId);

        // retrieve the permissions string
        const { permissions } = handlerInput.requestEnvelope.context.System.user;
        console.log('~~~~~~~ Permissions: ', permissions);

        // check to see if the user has granted permissions yet
        if (!permissions) {
            return handlerInput.responseBuilder
                .speak("This skill requires permissions to access your reminders and use your name, please grant them before proceeding. ")
                .addDirective({
                    type: "Connections.SendRequest",
                    name: "AskFor",
                    payload: {
                        "@type": "AskForPermissionsConsentRequest",
                        "@version": "2",
                        "permissionScopes": [
                            {
                                "permissionScope": "alexa::alerts:reminders:skill:readwrite",
                                "consentLevel": "ACCOUNT"
                            },
                            {
                                "permissionScope": "alexa::profile:given_name:read",
                                "consentLevel": "ACCOUNT"
                            } 
                        ]
                    },
                    token: "" + userId
                })
                .withShouldEndSession(true);
        }
        
        let givenName = '';
        try {
            const upsServiceClient = handlerInput.serviceClientFactory.getUpsServiceClient();
            givenName = await upsServiceClient.getProfileGivenName();
            // console.log("~~~~~ Given Name: ", givenName);
        } catch(error) {
            console.log("~~~ Error Getting Users Name: ", error);
            
            return handlerInput.responseBuilder
                .speak("It seems the permissions necessary to use this skill are not granted, please grant them in the Alexa app and try again. ")
                .withShouldEndSession(true)
                .getResponse();
        }
        
        const speakOutput = 'Hello ' + givenName + '! What would you like to do?';
        
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

/*
 * This handler will fire upon the user responding to a Permissions request
 */
const ConnectionsResponseHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'Connections.Response';
    },
    async handle(handlerInput) {
        console.log("~~~~~~ Connections Request handler entered");
        
        const accepted = handlerInput.requestEnvelope.request.payload.status !== 'DENIED';
        
        if (!accepted) {
            return handlerInput.responseBuilder
                .speak('Permissions must be granted to use this skill, either try again or grant the necessary permissions from the Alexa app')
                .getResponse();
        }
        
        let givenName = '';
        try {
            const upsServiceClient = handlerInput.serviceClientFactory.getUpsServiceClient();
            givenName = await upsServiceClient.getProfileGivenName();
            // console.log("~~~~~ Given Name: ", givenName);
        } catch(error) {
            console.log("~~~ Error Getting Users Name: ", error);
            
            return handlerInput.responseBuilder
                .speak("It seems the permissions necessary to use this skill are not granted, please grant them in the Alexa app and try again. ")
                .withShouldEndSession(true)
                .getResponse();
        }
        
        return handlerInput.responseBuilder
            .speak('Welcome to Smart Prompt, ' + givenName + '! What would you like to do?')
            .reprompt('Welcome to Smart Prompt, ' + givenName + '! What would you like to do?')
            .getResponse();
    }
}

const CreateReminderIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'CreateReminderIntent';
    },
    async handle(handlerInput) {
        
        console.log(handlerInput.requestEnvelope.context.System);
        
        // If the user says no at any point, cancel the process
        if (handlerInput.requestEnvelope.request.intent.confirmationStatus === "DENIED") {
            return handlerInput.responseBuilder
                .speak("Ok, I won't create that reminder.")
                .withShouldEndSession(true)
                .getResponse();
        }
        
        // retrieve the users given name for use later (do this no as to avoid creating the reminder and have this error out afterwards)
        let givenName = '';
        try {
            const upsServiceClient = handlerInput.serviceClientFactory.getUpsServiceClient();
            givenName = await upsServiceClient.getProfileGivenName();
            console.log("~~~~~ Given Name: ", givenName);
        } catch(error) {
            console.log("~~~ Error Getting Users Name: ", error);
            
            return handlerInput.responseBuilder
                .speak("It seems the permissions necessary to use this skill are not granted, please grant them in the Alexa app and try again. ")
                .withShouldEndSession(true)
                .getResponse();
        }
        
        // array of day acronym constants for use with the rmeinder api
        const dayAcronyms = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
        
        // retrieve user id and parse it for use with firebase
        const { userId } = handlerInput.requestEnvelope.context.System.user;
        const firebaseUserId = ("" + userId).replace("amzn1.ask.account.", "");
        console.log('users/' + firebaseUserId + '/reminders');
        
        // grab the intent data in order to read slot values
        const currentIntent = handlerInput.requestEnvelope.request.intent;
        
        // get the reminderDay reminderTime, and reminderMessage slot values & log them
        let reminderDay = currentIntent.slots.reminderDay.value;
        let reminderTime = currentIntent.slots.reminderTime.value;
        let reminderMessage = currentIntent.slots.reminderMessage.value;
        console.log('~~~ Day: ', reminderDay);
        console.log('~~~ Time: ', reminderTime);
        console.log('~~~ Message: ', reminderMessage);
        
        // parse the hour and minutes from the reminder time slot value
        let reminderHour = ("" + reminderTime).slice(0, 2);
        let reminderMinute = ("" + reminderTime).slice(3, 5);
        
        // parse the reminderDay slot value to determine the correct acrnoym to be passed to the reminder API
        let reminderDayIndex = -1;
        switch (reminderDay.toLowerCase()) {
            case "sunday":
                reminderDayIndex = 0;
                break;
            case "monday":
                reminderDayIndex = 1;
                break;
            case "tuesday":
                reminderDayIndex = 2;
                break;
            case "wednesday":
                reminderDayIndex = 3;
                break;
            case "thursday":
                reminderDayIndex = 4;
                break;
            case "friday":
                reminderDayIndex = 5;
                break;
            case "saturday":
                reminderDayIndex = 6;
                break;
            default:
                return handlerInput.responseBuilder
                    .speak("There was an error creating the reminder, please try again. ")
                    .withShouldEndSession(true)
                    .getResponse();
        }
        
        // default amount of time between snoozes (in minutes)
        const snoozeTime = 30;
        // default number of snoozes (how many times the alarm goes off in addition to the first time)
        // ***** The code is currently not complete to handle multiple snoozes. 
        //          The extra alarms will be created correctly, 
        //          but if the user completes a task before a snooze is set to go off, 
        //          the project is not set up to cancel the snooze. *****
        const numSnoozes = 0;
        
        // instructions for the user upon the reminder going off
        const reminderRecordingInstructions = ". Once complete, please say to me, 'tell smart prompt I have completed the task'.";
        
        // get the current date and time for use in the reminder object
        const currentDateTime = moment.tz('America/New_York');  // TODO: Need to update the time zone here to match the user's
        
        // api client for creating reminders
        const reminderApiClient = handlerInput.serviceClientFactory.getReminderManagementServiceClient();
        
        // arry to hold ids of created reminders
        const reminderIds = [];
        
        // iterate through the total number of needed alarms (1 initial + how ever many snoozes)
        for (let i = 0; i < 1 + numSnoozes; i++) {
            
            // Add the snooze time to the reminder minutes (i.e., how many minutes after the initial alarm it should go off)
            let minute = parseInt(reminderMinute) + (i * snoozeTime);
            
            // roll over to the hour if necessary
            let hour = parseInt(reminderHour);
            if (minute >= 60) {
                hour += 1;
                minute -= 60;
            }
            
            // roll over to the next day if necessary
            let dayIndex = reminderDayIndex;
            if (hour >= 24) {
                if (dayIndex === 6) {
                    dayIndex = 0;
                } else {
                    dayIndex += 1;
                }
                hour -= 24;
            }
            
            console.log('Creating a new reminder on ', dayAcronyms[dayIndex], 'at ', hour, ':', minute);
            
            // initialize the body of the api request
            const reminderBody = {
                "requestTime": currentDateTime.format('YYYY-MM-DDTHH:mm:ss'),
                "trigger": {
                    "type" : "SCHEDULED_ABSOLUTE",
                    "recurrence": {
                        "recurrenceRules" : [                                          
                            "FREQ=WEEKLY;BYDAY=" + dayAcronyms[dayIndex] + ";BYHOUR=" + hour + ";BYMINUTE=" + minute + ";BYSECOND=0;INTERVAL=1;"
                        ]
                    }
                },
                "alertInfo": {
                    "spokenInfo": {
                        "content": [{
                            "locale": "en-US",
                            "text": reminderMessage + reminderRecordingInstructions,
                        }]
                    }
                },
                "pushNotification" : {                            
                    "status" : "ENABLED"
                }
            };

            try {
                // make the post request to the create the reminder and store the id
                const { alertToken } = await reminderApiClient.createReminder(reminderBody);
                reminderIds.push(alertToken);
            } catch(error) {
                console.log("~~~ Error Creating new Reminder: ", error);
                
                return handlerInput.responseBuilder
                    .speak("There was an error creating the reminder, please check permissions and try again. ")
                    .withShouldEndSession(true)
                    .getResponse();
            }
            
            console.log("id of new reminder: " + reminderIds[i]);
        }
        
        firebase.database().goOnline();
        try {
            // create a new reminder object in firebase for the default reminder
            await database.ref('users/' + firebaseUserId + '/reminders/' + reminderIds[0]).set({
                "task": reminderMessage,
                "reminderDay": reminderDay,
                "reminderTime": reminderTime,
                "iterations": ''
            });
            
            // add the snooze reminders to the database
            await database.ref('users/' + firebaseUserId + '/reminders/' + reminderIds[0] + '/snoozes').set(reminderIds.slice(1));
            
        } catch(error) {
            console.log("~~~ Error Creating new Reminder: ", error);
            
            firebase.database().goOffline();

            return handlerInput.responseBuilder
                .speak("There was an error creating the reminder, please check permissions and try again. ")
                .withShouldEndSession(true)
                .getResponse();
        }
        firebase.database().goOffline();
        
        // parse the time in order to create a more user friendly time format
        let reminderHourInt = parseInt(reminderHour);
        let partOfDay = "a. m.";
        if (reminderHourInt >= 12) {
            if (reminderHourInt !== 12) reminderHourInt -= 12;
            partOfDay = "p. m.";
        }
        
        const speakOutput = "Alright " + givenName + ", I have created a new reminder on " + reminderDay + " at " + reminderHourInt + ":" + reminderMinute + " " + partOfDay;
        
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .withShouldEndSession(true)
            .getResponse();
    }
};

/*
 * Handler for when user records a task as complete
 * 
 * Records the task as complete in firebase
 */
const CompletedReminderIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'CompletedReminderIntent';
    },
    async handle(handlerInput) {
        console.log('~~~~ completed reminder intent entered.');
        
        // retrieve user id and parse it for use with firebase
        const { userId } = handlerInput.requestEnvelope.context.System.user;
        const firebaseUserId = ("" + userId).replace("amzn1.ask.account.", "");
        console.log('users/' + firebaseUserId + '/reminders');
        
        let audioFile = '';
        
        firebase.database().goOnline();
        try {
            // get the previous reminder id
            let previousReminder = await getFirebaseData('users/' + firebaseUserId + '/previousReminder');
            console.log("previous reminder: " + previousReminder);
            
            if (!previousReminder) {
                firebase.database().goOffline();
                
                return handlerInput.responseBuilder
                    .speak("There is no reminder to be completed at this time. ")
                    .withShouldEndSession(true)
                    .getResponse();
            }
            
            // get the previous reminder iteration
            let previousReminderIteration = await getFirebaseData('users/' + firebaseUserId + '/previousReminderIteration');
            // console.log("previous reminder iteration: " + previousReminderIteration);
            
            let currentTime = Date.now();
            
            // record the completion time of the reminder
            await database.ref('users/' + firebaseUserId + '/reminders/' + previousReminder + '/iterations/' + previousReminderIteration + '/completionTime').set(currentTime);
            
            // record the reminder as complete
            await database.ref('users/' + firebaseUserId + '/reminders/' + previousReminder + '/iterations/' + previousReminderIteration + '/completed').set(true);
            
            // clear the previousReminder field in the db
            await database.ref('users/' + firebaseUserId + '/previousReminder').set("");
            await database.ref('users/' + firebaseUserId + '/previousReminderIteration').set(0);
            
            
            // fetch the name of the file to be played
            audioFile = await getFirebaseData('users/' + firebaseUserId + '/reminders/' + previousReminder + '/audioFile');
            // console.log(audioFile);
            
            
            
            
            
            
            // TODO: check to see if there are snooze reminders set to go off in the coming minutes/hours
            //          if so, set them to not go off (find a way to update just this iteration and not the whole series)
            
            // api client for creating reminders
            // const reminderApiClient = handlerInput.serviceClientFactory.getReminderManagementServiceClient();
            
            // const snoozes = await getFirebaseData('users/' + firebaseUserId + '/reminders/' + previousReminder + '/snoozes');
            
            // for (let i = 0; i < snoozes.length; i++) {
            //     reminderApiClient.updateReminder(previousReminder, {});
            // }
            
            
            
            
            
            
            
            
            console.log('finished recording reminder as complete. ');
            
        } catch(error) {
            console.log("~~~ Error Recording Reminder as Complete: ", error);
            
            firebase.database().goOffline();

            return handlerInput.responseBuilder
                .speak("There was an error recording the reminder as complete, please try again. ")
                .withShouldEndSession(true)
                .getResponse();
        }
        firebase.database().goOffline();
        
        let givenName = '';
        try {
            const upsServiceClient = handlerInput.serviceClientFactory.getUpsServiceClient();
            givenName = await upsServiceClient.getProfileGivenName();
            // console.log("~~~~~ Given Name: ", givenName);
        } catch(error) {
            console.log("~~~ Error Getting Users Name: ", error);
            
            return handlerInput.responseBuilder
                .speak("It seems the permissions necessary to use this skill are not granted, please grant them in the Alexa app and try again. ")
                .withShouldEndSession(true)
                .getResponse();
        }
        let speakOutput = 'Thank you ' + givenName + ', your task has been recorded as complete!';
        
        if (audioFile) {
            const url = Utils.getS3PreSignedUrl("Media/" + audioFile).replace(/&/g, '&amp;');
            
            speakOutput += '<audio src="' + url + '" />';
        }

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .getResponse();
    }
};

/*
 * This handler fires whenever a reminder goes off
 */
const ReminderStartedEventHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'Reminders.ReminderStarted';
    },
    async handle(handlerInput) {
        console.log('~~~~ Reminder Started event handler has fired. ');
        
        // retrieve user id and parse it for use with firebase
        const { userId } = handlerInput.requestEnvelope.context.System.user;
        const firebaseUserId = ("" + userId).replace("amzn1.ask.account.", "");
        console.log('users/' + firebaseUserId + '/reminders');
        
        // retrieve the id of the reminder currently going off
        const reminderId = handlerInput.requestEnvelope.request.body.alertToken;
        console.log("reminder id: " + reminderId);
        
        firebase.database().goOnline();
        try {
            // check to see if the reminder id exist at the user level in the db
            // if it does not, that means it is simply a snooze iteration of another reminder, so do nothing
            // (or there is a major issue)
            const reminder = await getFirebaseData('users/' + firebaseUserId + '/reminders/' + reminderId);
            
            
            
            // TODO: add something here to check if the reminder is a snooze of another reminder
            // use the previous reminder field to check
            
            
            
            
            
            
            if (reminder) {
                const iterations = await getFirebaseData('users/' + firebaseUserId + '/reminders/' + reminderId + '/iterations');
                // console.log('~~~~~~~~ Iterations: ', iterations);
                
                if (iterations === '') {
                    // add a new iteration
                    await database.ref('users/' + firebaseUserId + '/reminders/' + reminderId + '/iterations').set([{
                        "completed": false,
                        "timesGoneOff": 0,
                        "startTime": '',
                        "previousAlarmTime": '',
                        "completionTime": '',
                    }]);
                } else if (iterations[iterations.length - 1].completed === true || iterations[iterations.length - 1].timesGoneOff >= 3) {
                    iterations.push({
                        "completed": false,
                        "timesGoneOff": 0,
                        "startTime": '',
                        "previousAlarmTime": '',
                        "completionTime": '',
                    });
                    await database.ref('users/' + firebaseUserId + '/reminders/' + reminderId + '/iterations').set(iterations);
                }
                
                const newIterations = await getFirebaseData('users/' + firebaseUserId + '/reminders/' + reminderId + '/iterations');
                // console.log('~~~~~~~~ New Iterations: ', newIterations);
                const currentIterationIndex = newIterations.length - 1;
                
                // set the previousReminder field in firebase to be equal to the id of the current reminder
                await database.ref('users/' + firebaseUserId + '/previousReminder').set(reminderId);
                await database.ref('users/' + firebaseUserId + '/previousReminderIteration').set(currentIterationIndex);
                
                // get the number of times this reminder has gone off in order to update it
                const timesGoneOff = await getFirebaseData('users/' + firebaseUserId + '/reminders/' + reminderId + '/iterations/' + currentIterationIndex + '/timesGoneOff');
                
                // If this is the first time the reminder has gone off, record what time it is
                // so that when the task is completed it can be determined how long it took
                let currentTime = Date.now();
                if (timesGoneOff === 0) {
                    // record the start time of this reminder
                    await database.ref('users/' + firebaseUserId + '/reminders/' + reminderId + '/iterations/' + currentIterationIndex + '/startTime').set(currentTime);
                }
                await database.ref('users/' + firebaseUserId + '/reminders/' + reminderId + '/iterations/' + currentIterationIndex + '/previousAlarmTime').set(currentTime);
                
                // increment the number of times this reminder has gone off
                await database.ref('users/' + firebaseUserId + '/reminders/' + reminderId + '/iterations/' + currentIterationIndex + '/timesGoneOff').set(timesGoneOff + 1);
                
                console.log('finished updating current reminder. ');
            }
        } catch(error) {
            console.log("~~~ Error updating current reminder: ", error);
        }
        firebase.database().goOffline();

    }
};

/*
 * This handler fires whenever a reminder is created
 */
const ReminderCreatedEventHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'Reminders.ReminderCreated';
    },
    async handle(handlerInput) {
        console.log('~~~~ Reminder Created event handler has fired. ');
    }
};

/*
 * This handler fires whenever a reminder is deleted
 */
const ReminderDeletedEventHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'Reminders.ReminderDeleted';
    },
    async handle(handlerInput) {
        console.log('~~~~ Reminder Deleted event handler has fired. ');
        
        // retrieve user id and parse it for use with firebase
        const { userId } = handlerInput.requestEnvelope.context.System.user;
        const firebaseUserId = ("" + userId).replace("amzn1.ask.account.", "");
        console.log('users/' + firebaseUserId + '/reminders');
        
        // retrieve the id of the reminder currently going off
        const reminderIds = handlerInput.requestEnvelope.request.body.alertTokens;
        // console.log("reminder ids: ");
        // console.log(reminderIds);
        
        firebase.database().goOnline();
        // iterate through each reminder that was deleted
        for (let i = 0; i < reminderIds.length; i++) {
            try {
                // clear the reminder from the db
                await database.ref('users/' + firebaseUserId + '/reminders/' + reminderIds[i]).set(null);
                
                console.log('finished deleting reminder. ');
                
            } catch(error) {
                console.log("~~~ Error deleting current reminder: ", error);
            }
        }
        firebase.database().goOffline();

    }
};

/*
 * This handler fires whenever a reminder is updated
 */
const ReminderUpdatedEventHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'Reminders.ReminderUpdated';
    },
    async handle(handlerInput) {
        console.log('~~~~ Reminder Updated event handler has fired. ');
        
        // retrieve user id and parse it for use with firebase
        const { userId } = handlerInput.requestEnvelope.context.System.user;
        const firebaseUserId = ("" + userId).replace("amzn1.ask.account.", "");
        console.log('users/' + firebaseUserId + '/reminders');
        
        console.log(handlerInput.requestEnvelope);
        
        // retrieve the id of the reminder currently going off
        const reminderIds = handlerInput.requestEnvelope.request.body.alertTokens;
        console.log("reminder ids: ");
        console.log(reminderIds);
        
        // TODO: figure out how to get the updated info of the reminder and update the database 
    }
};

/*
 * This handler fires whenever a reminder has its status changed
 */
const ReminderStatusChangedEventHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'Reminders.ReminderStatusChanged';
    },
    async handle(handlerInput) {
        console.log('~~~~ Reminder Status Changed event handler has fired. ');
    }
};

const HelloWorldIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'HelloWorldIntent';
    },
    handle(handlerInput) {
        console.log('~~~~ hello world intent entered.');
        
        const speakOutput = 'Hello there. '
        
        return handlerInput.responseBuilder
            .speak(speakOutput)
            //.reprompt('add a reprompt if you want to keep the session open for the user to respond')
            .getResponse();
    }
};

const HelpIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        const speakOutput = 'You can say hello to me! How can I help?';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent'
                || Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent');
    },
    handle(handlerInput) {
        const speakOutput = 'Goodbye!';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .getResponse();
    }
};
/* *
 * FallbackIntent triggers when a customer says something that doesn’t map to any intents in your skill
 * It must also be defined in the language model (if the locale supports it)
 * This handler can be safely added but will be ingnored in locales that do not support it yet 
 * */
const FallbackIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.FallbackIntent';
    },
    handle(handlerInput) {
        const speakOutput = 'Sorry, I don\'t know about that. Please try again.';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};
/* *
 * SessionEndedRequest notifies that a session was ended. This handler will be triggered when a currently open 
 * session is closed for one of the following reasons: 1) The user says "exit" or "quit". 2) The user does not 
 * respond or says something that does not match an intent defined in your voice model. 3) An error occurs 
 * */
const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        console.log(`~~~~ Session ended: ${JSON.stringify(handlerInput.requestEnvelope)}`);
        // Any cleanup logic goes here.
        return handlerInput.responseBuilder.getResponse(); // notice we send an empty response
    }
};
/* *
 * The intent reflector is used for interaction model testing and debugging.
 * It will simply repeat the intent the user said. You can create custom handlers for your intents 
 * by defining them above, then also adding them to the request handler chain below 
 * */
const IntentReflectorHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest';
    },
    handle(handlerInput) {
        const intentName = Alexa.getIntentName(handlerInput.requestEnvelope);
        const speakOutput = `You just triggered ${intentName}`;

        return handlerInput.responseBuilder
            .speak(speakOutput)
            //.reprompt('add a reprompt if you want to keep the session open for the user to respond')
            .getResponse();
    }
};
/**
 * Generic error handling to capture any syntax or routing errors. If you receive an error
 * stating the request handler chain is not found, you have not implemented a handler for
 * the intent being invoked or included it in the skill builder below 
 * */
const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        console.log("~~~~~~ Error Handler Input: ", handlerInput);
        const speakOutput = 'Sorry, I had trouble doing what you asked. Please try again.';
        console.log(`~~~~ Error handled: ${JSON.stringify(error)}`);

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

/**
 * This handler acts as the entry point for your skill, routing all request and response
 * payloads to the handlers above. Make sure any new handlers or interceptors you've
 * defined are included below. The order matters - they're processed top to bottom 
 * */
exports.handler = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        LaunchRequestHandler,
        ConnectionsResponseHandler,

        // Custom Intents
        CreateReminderIntentHandler,
        CompletedReminderIntentHandler,
        
        // Reminder events
        ReminderStartedEventHandler,
        ReminderCreatedEventHandler,
        ReminderDeletedEventHandler,
        ReminderUpdatedEventHandler,
        ReminderStatusChangedEventHandler,
        
        HelloWorldIntentHandler,
        HelpIntentHandler,
        CancelAndStopIntentHandler,
        FallbackIntentHandler,
        SessionEndedRequestHandler,
        IntentReflectorHandler)
    .addErrorHandlers(
        ErrorHandler)
    .withApiClient(new Alexa.DefaultApiClient())
    // .withCustomUserAgent('sample/hello-world/v1.2')
    .lambda();