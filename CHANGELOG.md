# Chlu API Publish Changelog

## v0.6.0

- allow user to import reviews multiple times
- much improved `GET /crawl` API to show all running jobs (breaking change)
- don't allow user to start a crawler job for a service if there is already a job like that running

Known issues:

- if the service is shut down while an operation is in progress, it will stay in an inconsisted state in the DB

## v0.5.0

- allow scaling by keeping crawling status in a database
- uses SQLite by default, supports PostgreSQL
- more tests
- changed `GET /crawl` API to `GET /crawl/:did`

## v0.4.0

- crawl requests need to be signed

## v0.3.2

- updated linkedin and upwork crawlers

## v0.3.1

- updated crawling system

## v0.3.0

- experimental review crawling support

## v0.2.0

- added CLI params for Chlu SQL DB

## v0.1.0

First release
