# beard


{for cat in cats}
	{cat.name}
	{cat.size}
	{for home in cat.homes}
		{home.address}
	{end}
{end}


api ideas

{hello}

{hello.world}

{for cat in cats}
	{cat.name}
	{cat.size}
	{for home in cat.homes}
		{home.address}
	{end}
{end}


{if cat eq dog}
	// do something
{else if (cat eq 'jack') or giraffe}
	// do something
{else}
	// do something
{end}


{if name}
	Hello, {name}
{end}


Else clauses are also supported:

{if name}
	Hello, {name}
{else}
	Hello, Captain Anonymous
{end}


As are else..if clauses:

{if firstName}
	Hello, {firstName}
{else if lastName}
	Hello, Mr. {lastName}
{else}
	Hello, Captain Anonymous
{end}


Limited logical expressions are also possible:

{if user.lastName and user.isVip}
	Hello, Mr. {user.lastName}, my good man!
{end}

{if fred.tired or fred.bored}
	Fred: "Yawn!"
{end}

{if not awake}
	Zzz
{end}

eq & neq comparison operators are available for comparing two values:

{if config.feature eq "enabled"}
	Feature is enabled!
{end}

{if status neq "inactive"}
	Huzzah!
{end}


You can also group expressions using parentheses:

{if (a and b) or c}
	...
{end}

