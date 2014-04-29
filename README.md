backup.pass
==========

A simple personal KeePass backup web server built with node.js

## About

backup.pass aims to supply a little peace of mind to those of use
who use KeePass. Syncing to a phone works well to have access to
passwords when away from the home computer, but what happens when
the phone battery dies or the phone gets lost?

Backup.Pass attempts to address this issue by providing a small,
personal web server which can access the KeePass database. This is
meant to be a secure, *emergency* backup server.

## Security

backup.pass is not meant to be used on a regular basis.

- Five one-time use encryption keys are generated on setup.
- Each key is used to encrypt a separate copy of the KeePass
encryption key file. 
- Everytime a key is used, it is deleted.
- Once the KeePass database key file is decrypted, the user still must
supply the KeePass password to unlock the database.
- After 3 incorrect attempts the server shuts down.

## Dependencies

Minimal dependencies

- Express
- KeePass.io
- body-parser
- node-tmp

## Setup

```bash
node setup.js initial
```

- Copy keepass database to `./keepass.`
- Copy keepass database key file to `./do_not_include`
- Build backup.pass keys:

```bash
node setup.js production
```

- **Print and keep the one-time keys with you.** They won't do you any good unless you have them when you need them!

## Deploy

- Currently optimized for heroku, but should be easy to migrate to other services