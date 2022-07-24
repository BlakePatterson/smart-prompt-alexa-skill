# Smart Prompt - Alexa Skill

## Introduction
Smart Prompt is an Alexa skill aimed at setting smarter & more personalized reminders. 
Smart Prompt allows users to create weekly reminders that go off at a given day & time. 
After a reminder goes off the user has the chance to either ask for the alarm to be snoozed, or tell Smart Prompt they have completed the task. 
Upon telling Smart Prompt that they completed the task, it will track how long the task took & how many times the alarm was snoozed, as well as optionally play a custom audio file as a reward!

## First Use
Smart prompt requires permissions in order to create reminders for you and refer to you by your given name. 
As these are core functionalities of the skill, it will require you to grant them right off the bat. 

There are two ways to grant permissions:
### 1. Have Smart Prompt Ask You
First, launch the skill by simply saying, 
```
"Alexa, open Smart Prompt"
```
Alexa will then directly ask you to grant permissions. 
You may approve or decline them, although declining them will simply keep you from using Smart Prompt. 
Once you approve them, you will have full access to Smart Prompt's features immediately afterwards.

### 2. In the Alexa App
If you prefer to accept the permissions manually
you may do so by simply opening the Alexa App (mobile or [web](https://alexa.amazon.com/)), navigating to the Skills menu, 
then Your Skills, then Smart Prompt, then Settings, and finally you can check off the two required permissions. 

As a side note, it is possible to only check off one of the two permissions, although many parts of the skill will be unusable and it will simply request that you grant the necessary permissions. 

## Creating a Reminder
To create a new reminder, simply ask Smart Prompt. 
First, launch Smart Prompt using the same launch phrase listed above, and then say anything along the lines of
```
"Create a new reminder"
```
The skill will then prompt you for three pieces of information one by one: 
- Day of the Week, i.e., Monday, Tuesday, etc.
- Time of Day, i.e., 9:00 a.m., Noon, 10:00 p.m., etc.
- Task / Reminder Message, i.e., "Take <medication>", "Walk the dog", "Make Coffee"

Once you provide these three pieces of information, Alexa will repeat them to you and ask you to confirm that they are correct. 
If anything was recorded incorrectly, you may simply say no & restart the process. 
Otherwise, simply say yes and the reminder will be created. 

Additionally, you may also expedite the process by providing the day & time from the start. Just say anything along the lines of
```
"Create a new reminder on Monday at noon"
```

As a side note, it is worth mentioning that you must create the reminder using this method and not throughout the Alexa App. 
Any reminder created through other means will not be registered with Smart Prompt & will be missing most of the corresponding features. 

## Snoozing a Reminder
Snoozing a reminder works exactly the same as any other reminder on Alexa. 
When an alarm goes off, simply say something along the lines of 
```
"Alexa, snooze that reminder for five minutes"
```

## Recording a Reminder as Complete
As one of the main purposes of Smart Prompt is to be able to track the completion rate of tasks as well as how long they take, it is encouraged to always tell Smart Prompt when you have completed a task it reminded you to do. 

To do this, simply launch Smart Prompt and say something along the lines of
```
"I have completed my task"
```

Upon doing so, Smart Prompt will record the previous reminder that went off as complete as well as how long it was since the reminder first went off (The completion record & duration of time is recorded separately per week for each reminder).

As a side note, do not mention the exact task you completed when performing this action. 
Smart Prompt is simply unable of recognizing the specific task by name at the moment. 

## Deleting / Updating / Managing Reminders
Deleting, updating, and generally managing reminders can be handled in exactly the same way as any normal Alexa reminder would be handled.
The simplest way is through the Alexa App. All of the basic information of a reminder can be viewed and edited from there. 

Although it is recommended to use the app, you may also ask Alexa about your reminders at any time. 

For example, simply say something along the lines of
```
"Alexa, what are my reminders"
```
or
```
"Alexa, get rid of my reminder to make coffee"
```

Be mindful when doing this, however, as Alexa itself will not directly differentiate between Smart Prompt reminders and its own reminders. 

## Audio Files
As mentioned prior, one optional component of Smart Prompt is to have a custom audio file play when you record a task as complete. 
Anything from a favorite song to a clip of a loved one offering congratulatory words, whatever motivates the user to complete their task can be played. 
There are two steps to setting this up. 

### 1. Audio File Formatting
Any standard MP3 file can be used with Smart Prompt, but there is some formatting it must go through prior to uploading it, otherwise Alexa will simply not play it. 
[Here is a link](https://developer.amazon.com/en-US/docs/alexa/custom-skills/speech-synthesis-markup-language-ssml-reference.html#h3_converting_mp3) directly to Amazon's instructions on audio formatting. 
They provide two methods, a command line tool as well as Audacity (a popular & free audio editing software), but it is highly recommended to use Audacity as it is more straight-forward and reliable. 
[Here is a link](https://youtu.be/pKlnpf0SsoE?t=116) to a youtube video describing to steps to format the file in Audacity. 
Essentially, you just need to open your MP3 file in Audacity, set the project rate to 16,000, go to File, then Export, set the save type to MP3, set the bit rate mode to constant, and finally set the quality to 48 kbps. 
With all of that done you can save this new MP3 file and the formatting is complete. 

### 2. Uploading to S3 & Linking to DB
With your formatted MP3 in hand, there are only two things left to do. 
First, you must upload the file to the Amazon S3 Bucket tied to Smart Prompt. 
To do this, simply open Smart Prompt in the Amazon Developer Console, navigate to the code tab, and click on S3 Storage in the toolbar at the top. 
This will open the S3 Management Console in a new tab, and from here you may simply click upload and drag and drop your MP3 file. 

Finally, you just need to add the MP3 file name to whichever reminders you would like it to play for in the database. 
To do this, open Smart Prompt in the Firebase Console and navigate to the Realtime Database. 
From here, find your user and expand it, and then find your reminder and expand it. 
Then, simply add the following field to the reminder object
```
audioFile: <file_name>.mp3
```
Make sure the field name is spelled correctly as well as the file name, and then you are good to go. 
The next time you record this reminder as complete, the audio file will be played as a reward. 
You may also add this audio file to as many reminders as you would like. 

As a final side note, an easier, more streamlined, and more secure way of uploading and managing audio files will be implemented in the future. 

## Extras
One thing worth noting is that, as with any skill, the launch sequence can be expedited by simply saying, 
```
"Alexa, tell <skill_name> <intent>"
```

For example, to quickly tell Smart Prompt you have completed a task, simply say,
```
"Alexa, tell Smart Prompt I have completed the task"
```
This can make navigating Smart Prompt, or any other skill, much quicker and simpler. 
The only thing to take note of with this is that if you do this before granting permissions, the intent will simply not work and it will request that you grant permissions. 
