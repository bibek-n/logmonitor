package main

import (
	"strings"
	"testing"
)

// Confirmed live against several real pool.d configs: an error_log line with no same-line
// terminator (no trailing "; comment", no closing quote) let the old regex's value group run
// on past end-of-line and swallow the next directive(s) into the captured "path". This pins
// that the fix stops exactly at the line boundary regardless of what follows.
func TestPoolErrorLogRe_StopsAtLineEnd(t *testing.T) {
	cases := []struct {
		name string
		conf string
		want string
	}{
		{
			name: "unterminated value followed by another directive",
			conf: "php_admin_value[error_log] = /var/log/php7.4-fpm-eritadev-error.log\nphp_admin_flag[log_errors] = on\n",
			want: "/var/log/php7.4-fpm-eritadev-error.log",
		},
		{
			name: "unterminated value followed by several directives",
			conf: "php_admin_value[error_log] = /var/log/php-fpm/php8.4-booking-error.log\nphp_admin_flag[log_errors] = on\n\nrequest_slowlog_timeout = 5s\nslowlog = /var/log/php-fpm/php8.4-booking-slow.log\n",
			want: "/var/log/php-fpm/php8.4-booking-error.log",
		},
		{
			name: "plain error_log key, no admin_value wrapper",
			conf: "error_log = /var/log/php8.4-fpm-websearchpro.log\ncatch_workers_output = yes\n",
			want: "/var/log/php8.4-fpm-websearchpro.log",
		},
		{
			name: "trailing semicolon comment still respected",
			conf: "php_admin_value[error_log] = /var/log/foo.log ; per-site override\n",
			want: "/var/log/foo.log",
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			m := poolErrorLogRe.FindStringSubmatch(c.conf)
			if m == nil {
				t.Fatalf("no match found")
			}
			got := strings.TrimSpace(m[2])
			if got != c.want {
				t.Errorf("got %q, want %q", got, c.want)
			}
		})
	}
}

func TestIniErrorLogRe_StopsAtLineEnd(t *testing.T) {
	ini := "error_log = /var/log/php-cli-errors.log\ndisplay_errors = Off\n"
	m := iniErrorLogRe.FindStringSubmatch(ini)
	if m == nil {
		t.Fatalf("no match found")
	}
	if got, want := strings.TrimSpace(m[1]), "/var/log/php-cli-errors.log"; got != want {
		t.Errorf("got %q, want %q", got, want)
	}
}
