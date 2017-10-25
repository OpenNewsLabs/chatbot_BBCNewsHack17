# README

[Google doc tmp draft](https://docs.google.com/document/d/1n6B1vyQysIEeDfoDUqnVNzb7RVy_MNuyvrVekLQ0YZ4/edit?usp=sharing)

[Slides](https://docs.google.com/presentation/d/1ky52Q9UJ9VV_gl6hKQWBS5GrOIARIqogwSZbkswXcY0/edit#slide=id.p)




## Question verification component / summariztion 

Using ["Question Generation via Overgenerating Transformations and Ranking
"](https://www.cs.cmu.edu/~ark/mheilman/questions/) system. 


```json 
	{
		"speaker": "interviewee",
		"paragraphId": 1,
		"question":"What do I 'm coming to speak at open source to?",
		"answer": "Well I 'm coming to speak at open source open society to talk to people about how we can apply the concepts of the open source movement to larger parts of society.",
		"confidence": 1.2249347799141348
}		
```

Where question, answer, and confidence are what is returned by java jar, see this [exmaple output](Example output https://gist.github.com/Laurian/1115914)

```
INPUT:

"Napoleon Bonaparte was born on 15 August 1769 in Corsica into a gentry family. Educated at military school, he was rapidly promoted and in 1796, was made commander of the French army in Italy, where he forced Austria and its allies to make peace. In 1798, Napoleon conquered Ottoman-ruled Egypt in an attempt to strike at British trade routes with India. He was stranded when his fleet was destroyed by the British at the Battle of the Nile."

OUTPUT (Question + Source/Answer + score):

What did Napoleon conquer Ottoman-ruled Egypt in in 1798?	

In 1798, Napoleon conquered Ottoman-ruled Egypt in an attempt to strike at British trade routes with India. in an attempt to strike at British trade routes with India 

3.4447591093720233

```