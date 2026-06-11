#!/usr/bin/env perl

# Root-level fallback for building HCIreport/main.tex from the foodagent workspace.
# The HCI report contains Chinese text and Chinese figure names, so XeLaTeX is required.
use Cwd qw(abs_path);

my $hci_dir = abs_path('HCIreport');

$pdf_mode = 5;
$xelatex = 'xelatex -synctex=1 -interaction=nonstopmode -file-line-error -halt-on-error -shell-escape %O %S';

ensure_path("TEXINPUTS", "$hci_dir//");
ensure_path("TEXINPUTS", "$hci_dir/chapters//");
ensure_path("TEXINPUTS", "$hci_dir/figures//");
ensure_path("TEXINPUTS", "$hci_dir/style//");
ensure_path("BIBINPUTS", "$hci_dir/bib//");

$recursive_dir_scan = 1;
$max_repeat = 5;
