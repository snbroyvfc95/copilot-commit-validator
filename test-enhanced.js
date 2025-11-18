// Test file to trigger enhanced menu options with critical issues
console.log("This should trigger suggestions");
console.log("Multiple console.log statements");

var oldVar = "should use const";
var anotherOldVar = "another var usage";

if (data == null) {
  console.log("loose equality issue");
}

// Critical issue - undeclared variable
undeclaredVariable.push("test");
myUndefinedArray.includes("something");

// More issues
var password = "hardcoded123";
eval("dangerous code");

for (var i = 0; i < items.length; i++) {
  console.log(items[i]);
}