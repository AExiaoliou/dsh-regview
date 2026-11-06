# @aexiaoliou/dsh-regview-core

Base plugin of the dsh-regview inspector.

It provides the browser-side `ctx.regview` service, the global `sidebar.panellist` entry, the `main` panel page, the table/search/refresh UI, the stylesheet, and the locale refresh path. Feature packages contribute one `RegViewSource` each and never import this package's runtime.

Install it with `@aexiaoliou/dsh-regview-resources`, `@aexiaoliou/dsh-regview-sidebar-tabs`, `@aexiaoliou/dsh-regview-conversation-views`, `@aexiaoliou/dsh-regview-document-previews`, and `@aexiaoliou/dsh-regview-slots`; each installed source adds its category to the panel.

See the repository README for installation, the registrant rules, and known limitations.
