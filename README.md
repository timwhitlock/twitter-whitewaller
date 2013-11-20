# Twitter Whitewaller

Trashes tweets in bulk with options to keep the important ones.

Runs under Node JS.


## Install

Install via npm and initialize your OAuth credentials as follows:

    $ npm install twitter-whitewaller
    $ node tw.js init


## Usage

Edit (or copy and edit) `tw.js` and simply run it:

`$ node tw.js`

When running, it pages backwards through your Twitter timeline. When you hit an API rate limit, 
just leave it to wait and it will carry on when it can. If it quits the paging will start again. 
If it reaches the end of your timeline it can either stop or start again after a delay.


## Options

You can choose to keep tweets of a certain age, with certain tags and whether they've been retweeted or favourited by others.

See `tw.js` for fuller documentation of these options.
