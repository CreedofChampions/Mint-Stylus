---
title: "Working with Zettelkästen"
keywords:
  - Zettelkasten
  - Zettel
  - Knowledge Management
  - Niklas Luhmann
...

# Zettelkästen with Mint Stylus 🗂

Hello again! What you just clicked is what we refer to as “internal link” — these look a lot like wiki-links but actually they are a feature that helps Mint Stylus recognize how you organize your knowledge. Let’s first sort out what has just happened after you clicked the link.

Whenever you click an internal link, Mint Stylus will do two things at once: Start a full text search for its contents, and try to open the corresponding file. As you can see, the left sidebar now doesn't show you the files anymore, but instead search results. Also, you are now looking at this file!

To switch to the file manager or the full text search, you can use the three-way toggle in the upper-left corner of the toolbar.

> You can customize what Mint Stylus will do if you follow such internal links in the Zettelkasten preferences.

## Linking Files 🗄

When it comes to cross-linking files within your Zettelkasten, there are two general ways of doing so: Either by using an ID, or its filename (without extension). So if you have a file called “zettelkasten.md” you can link to it by writing `[[zettelkasten]]`. Mint Stylus will try to find a file with that filename and open it.

But what if you change the filename? Then, obviously the link will no longer work! To get around this limitation, you can make use of IDs. IDs are simply strings of digits that you can use to uniquely identify your files. Then you can use them to link to your files. Let’s create one now! Place the cursor behind the colon and press `Cmd/Ctrl+L`:

Now, this file has an ID which you can make use of! Try it out — go back to the tab with the “Welcome to Mint Stylus!”-guide, and type `[[` somewhere. From the popup autocomplete, choose this file and confirm your selection. Then, `Cmd/Ctrl`-click on that very link to switch back to this file. You’ll notice that Mint Stylus has started another search, but, more importantly: you can see the search results highlighted! This is useful both for Zettelkasten-crosslinking, but will of course also come in handy during global searches.

## Using Tags 🏷

But creating links is not the only way to create relationships between notes. You can also use tags for this. Tags work exactly like hashtags on Twitter, so you can #create #hashtags #as #much #as #you #want! `Cmd/Ctrl`-clicking these will also start a search and will highlight all files that contain this tag.

There’s also a tag cloud that you can access by clicking the “tag” icon in the toolbar. It will list all your tags and indicate the number of files using it. You can filter and manage your tags from there. While Zettelkasten-links create “hard” connections between files, tags are some sort of “fuzzy” connection between related content and may suit you better.

## Final Thoughts 💭

We won’t go over methods for how to actually work with a Zettelkasten here, because there are a lot of tutorials out there that will get you started. Here’s a handy list of good tutorials:

- [A first introduction can be found in our docs](https://docs.zettlr.com/en/pkms/zkn-method/)
- [On the concept of the Zettelkasten, read our blogpost](https://zettlr.com/post/what-is-a-zettelkasten)
- [The page zettelkasten.de (in English) contains many articles on Zettelkästen](https://zettelkasten.de/)
- [Reddit has a subreddit dedicated solely to the art of Zettelkasten](https://www.reddit.com/r/Zettelkasten)

These will prove excellent starting points for your journey to learn the arcane art of creating a Zettelkasten!

One last thing though: As the way Zettelkästen work is not very standardized, and there exist many right ways of doing it, Mint Stylus allows you to fully customize every single aspect of the Zettelkasten-methodology. To get started, have a look at [our documentation on how that works](https://docs.zettlr.com/en/reference/settings/#zettelkasten)!

**Ready for more?** Then head over to our guide on [[citing]] with Mint Stylus!
