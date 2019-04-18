## ted

Ted is the standard task editor :P

Lightweight ergonomic interactive command line task list editor

[`ed`](http://wiki.c2.com/?EdIsTheStandardTextEditor) for tasks

For the people who appreciate the simplicity of traditional TODO
files but who also has a lot of tasks and wish they were easily
taggable sortable filterable without requiring a bloated issue
tracker.

Read on to see what's different from existing command line task
managers.


## features & design choices

`ted` ..

- is an editor that works on a given task directory. It has no
  implicit project database. The "project" IS the directory you
  supply. It works like git in this sense.

- supports tag based categorization & filtering and priority based
  ordering.

- has no configuration, no command line flags and has only around
  10 commands. You can get comfortable with the whole feature set
  in 15 minutes.

- stores tasks as regular files in the task directory being
  edited. The directory and file structures are very simple and
  VCS-friendly. Diffs will be straightforward if you track your
  changes.

- is interactive. Commands are sent from inside the `ted` shell.
  You don't have to repeat the `ted` command every time. There is
  no non-interactive mode as `ted` is intended to be used directly
  by its end power-users all the time and not by scripts.

- is intentionally stateful. It remembers the filter, order and
  limit you set so you don't type them again and again.

- is all about intuitive single letter commands: c(reate), e(dit),
  ... You need A LOT less keystrokes to accomplish things compared
  to many other command line task managers.

- is not tightly coupled to any version control or synchronization
  system.

- is similar to the venerable UNIX editor `ed` (which is THE
  standard editor).


## non-features

Things that are intentionally not supported and suggested
alternatives:

- Attribution & synchronization: Use a VCS

- Assignments: Use tags like `@john`, `@jack`

- Statuses: Use tags like `!doing`, `!rejected`, `!blocked`

- Attachments: Link to files on the cloud

- Discussions, mentions, merge requests: Use email lists, email,
  patches over email. I mean, what was wrong with email?


## known issues

- Written in Javascript. A C or Rust version would probably be
  better. Any volunteers for porting?

- Not written with performance in mind, for now. Especially the
  indexing mechanism is very inefficient. That'll be addressed
  sooner or later.


## usage

    npm install -g ted-editor
    ted myissues


## commands

**Display:**

    <empty>               List tasks that match the current filter
    <id>                  Show task #<id>
    t                     Show tag list
    f                     Show current filter
    o                     Show current order
    l                     Show current limit

**Filter order limit:**

    f & <t1> [<t2> ..]  Set filter for all matching tags
    f | <t1> [<t2> ..]  Set filter for any matching tag
    f / <regex>         Set filter for given regex
    F                   Reset filter

    o <col1> [<col2> ..]  Set column(s) to order the list by. Prefix column names with "-" for descending order
    O                     Reset order

    l <lim>               Set limit
    L                     Reset limit

**Manipulate task:**

    c                     Create new task with system editor
    c <title>             Create new task immediately with the given title

    e <id>                Edit task with system editor
    t <id> <t1> [<t2> ..] Add/remove tags to/from task. Prefix a tag with "-" to remove it.
    p <id> <pri>          Set task priority

    a <id>                Archive task
    A <id>                Unarchive task

    d <id>                Delete task completely

**Other:**

    a                     Switch to the archives
    A                     Switch back from the archives
    h                     Help
    q                     Quit
    reindex               Update the internal index. Trigger after external updates


## task file format

    title

    priority tag1 tag2 tag3 ...

    all lines starting with this one are considered the task
    description.
    lorem ipsum dolor sit amet consectetuer adipisicing elit

    another paragraph w;elkr lk asdfasdkjf asdoiufh asdjf
    asdk faspdfi japdsiofh peiurhqewfk adslfhaspdoifh oadsf

    - john
    - paul
    - george
    - ringo

## index file format

    {
    "1":{"title":"lorem ipsum","pri":"5","tags":["test"]},
    "2":{"title":"dolor sit amet","pri":"9","tags":[]},
    ...
    }
