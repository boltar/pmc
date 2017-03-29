var test_str = 'asdf == English == asdf asdf === Pronunciation === pronunciation[] === Etymology === ety ==== Noun ==== no === Etymology === dont add this '

var test_str2 = 'asdf == English == asdf asdf === Pronunciation === pronunciation[] === Etymology 1 === ety1 ' +
	'=== Etymology 2 === ety2 ==== Noun ==== no === Etymology 1 === ety 1 don\'t add this'

var test_str3 = ' === Etymology 1 === ety1 == Latin == === Etymology === dont add'
var test_str4 = ' === Pronunciation 1 === pro1 == Latin == === Pronunciation === dont add'
var test_str5 = ' === Pronunciation 1 === pro1 === Bogus 1 === bog1 == Latin == === Pronunciation === dont add'


const anysection_rege = /(={2,} .*? ={2,})/g;
const ety_section = /={3,} Etymology (\d )?={3,}/
const pro_section = /={3,} Pronunciation (\d )?={3,}/
const double_section = /^={2} .*? ={2,}/

function find_wikt_section(heading, str)
{
	arr = str.split(anysection_rege);
	var result = [];
	var unique_headings = [];
	var started = 0;
	// does the heading exist?
	for (s of arr) {
		console.log("s: " + s);
		if (started && anysection_rege.exec(s) && double_section.exec(s))
		{
			break;
		}

		if (heading.exec(s))
		{
			if (unique_headings.indexOf(s) == -1)
			{
				// add unique headings
				unique_headings.push(s);
				// since it was a unique heading, add it to results
				result.push(arr[arr.indexOf(s)+1]);
				started = 1;
			}
		}
	}
	return result;
}

// console.log(find_wikt_section(ety_section, test_str));
console.log(find_wikt_section(ety_section, test_str2));
// console.log(find_wikt_section(ety_section, test_str3));
// console.log(find_wikt_section(pro_section, test_str4));
// console.log(find_wikt_section(pro_section, test_str5));
