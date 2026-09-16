---
title: "如何学习 SQL 语言？"
author: "曹彬AI"
source_url: "https://www.zhihu.com/question/19552975/answer/928021760"
collection: "我的收藏"
published_at: "2019-12-08 16:21"
extracted_at: "2026-09-16 13:38:27 Asia/Shanghai"
status: "完整"
---

# 如何学习 SQL 语言？

## 正文

刷题。

SQL 真的不难，用 20 个小时来学习完全足够了。

「1」刷题前之前了解下 SQL 是什么：

结构化查询语言(Structured Query Language)简称SQL，是一种数据库查询和程序设计语言，用于存取数据以及查询、更新和管理关系数据库系统。
SQL 语言在数据分析工作中有多重要？
141 赞同 · 0 评论 回答

「2」准备好工具书：《SQL必知必会》

「3」准备好网络教程（免费）：SQL 教程 | 菜鸟教程

「4」结合「2」和「3」了解下 SQL 的知识点：

「5」好了，开刷：

PART - 1

「先进入上面的链接自己做，再参考下面的答案」

「表结构」world (name, continent, area, population, gdp)

列出每個國家的名字 name，當中人口 population 是高於俄羅斯'Russia'的人口。
select name 
from world 
where population > (select population from world where name = 'Russia');

列出歐州每國家的人均GDP，當中人均GDP要高於英國'United Kingdom'的數值。
select name 
from world 
where continent = 'Europe' and (gdp/population) > (select gdp/population from world where name = 'United Kingdom'); 

在阿根廷 Argentina 及 澳大利亞 Australia 所在的洲份中，列出當中的國家名字 name 及洲分 continent 。按國字名字順序排序。
select name, continent 
from world 
where continent in ( select distinct continent from world where name = 'Argentina' or name = 'Australia') order by name; 

哪一個國家的人口比加拿大Canada的多，但比波蘭Poland的少?列出國家名字name和人口population 。
select name, population 
from world  
where population > (select population from world where name = 'Canada') and  population < (select population from world where name = 'Poland'); 

Germany德國（人口8000萬），在Europe歐洲國家的人口最多。Austria奧地利（人口850萬）擁有德國總人口的11％。顯示歐洲的國家名稱name和每個國家的人口population。以德國的人口的百分比作人口顯示。
select name,  CONCAT(Round(population/(select population from world where name = 'Germany')*100,0),'%') as new_po 
from world 
where continent = 'Europe'; 

找到世界上最大的國家(以人口計算)
SELECT name 
FROM world 
WHERE population >= ALL(SELECT population FROM world WHERE population>0); 

使用 population>0 的原因：有些國家的記錄中，人口是沒有填入，只有 null值。

哪些國家的GDP比Europe歐洲的全部國家都要高呢? [只需列出 name] (有些國家的記錄中，GDP是NULL，沒有填入資料的。)
select name 
from world 
where gdp > all(select gdp from world where continent = 'Europe' and gdp > 0); 

在每一個州中找出最大面積的國家，列出洲份 continent, 國家名字 name 及面積 area。 (有些國家的記錄中，AREA是NULL，沒有填入資料的。)
select continent, name, area 
from world a 
where area >= all(select area from world b where b.continent = a.continent and area > 0); 

列出洲份名稱，和每個洲份中國家名字按子母順序是排首位的國家名。(即每洲只有列一國)
select continent, name 
from
(
    select 
        continent
        ,name 
        ,row_number() over(partition by continent order by name) as num
    from world
) a 
where a.num = 1
;

找出洲份，當中全部國家都有少於或等於 25000000 人口. 在這些洲份中，列出國家名字name，continent 洲份和population人口。

解1：

select name, continent, population 
from world a  
where (select max(population) from world b where b.continent = a.continent) <= 25000000; 

解2：

select name, continent, population 
from world a  
where 25000000 >= all(select population from world b where b.continent = a.continent and population > 0); 

有些國家的人口是同洲份的所有其他國的3倍或以上。列出國家名字name 和 洲份 continent。
select name, continent  
from world a 
where (a.population/3) >= all(select population from world b where b.continent = a.continent and population > 0 and b.name != a.name); 

PART - 2

「先进入上面的链接自己做，再参考下面的答案」

列出 賽事編號matchid 和球員名 player ,該球員代表德國隊Germany入球的。要找出德國隊球員，要檢查: teamid = 'GER'
select matchid, player 
from goal 
where teamid = 'GER'; 

由以上查詢，你可見Lars Bender's 於賽事 1012入球。.現在我們想知道此賽事的對賽隊伍是哪一隊。留意在 goal 表格中的欄位 matchid ，是對應表格game的欄位id。我們可以在表格 game中找出賽事1012的資料。只顯示賽事1012的 id, stadium, team1, team2
select id,stadium,team1,team2 
from game 
where id = 1012; 

列出每個入球的球員(來自goal表格)和場館名(來自game表格)。修改它來顯示每一個德國入球的球員名，隊伍名，場館和日期。
select a.player, a.teamid, b.stadium, b.mdate 
from  
(select matchid, player, teamid from goal where teamid = 'GER') a 
left join 
(select id, mdate, stadium from game) b 
on a.matchid = b.id; 

列出球員名字叫Mario (player LIKE 'Mario%')有入球的 隊伍1 team1, 隊伍2 team2 和 球員名 player。
select b.team1, b.team2, a.player 
from  
(select matchid, player from goal where player like 'Mario%') a 
left join 
(select id, team1, team2 from game) b 
on a.matchid = b.id; 

列出每場球賽中首10分鐘gtime<=10有入球的球員 player, 隊伍teamid, 教練coach, 入球時間gtime。
select a.player, a.teamid, b.coach, a.gtime 
from  
(select teamid, player, gtime from goal where gtime <= 10) a 
left join 
(select id, coach from eteam) b 
on a.teamid = b.id; 

列出'Fernando Santos'作為隊伍1 team1 的教練的賽事日期，和隊伍名。
select b.mdate, a.teamname 
from  
(select id, coach, teamname from eteam where coach = 'Fernando Santos') a 
left join  
(select team1, mdate from game) b 
on a.id = b.team1; 

列出場館 'National Stadium, Warsaw'的入球球員。
select b.player 
from  
(select id, stadium from game where stadium = 'National Stadium, Warsaw') a 
left join  
(select matchid, player from goal) b 
on a.id = b.matchid; 

修改它，只列出全部賽事，射入德國龍門的球員名字。
select distinct a.player 
from  
(select matchid, player from goal where teamid != 'GER') a 
join 
(select id from game where team1 = 'GER' or team2 = 'GER') b 
on a.matchid = b.id; 

列出隊伍名稱 teamname 和該隊入球總數。
select b.teamname, count(a.teamid) as goal_num 
from  
(select teamid from goal) a 
left join 
(select id, teamname from eteam) b 
on a.teamid = b.id 
group by b.teamname; 

列出場館名和在該場館的入球數字。
select b.stadium, count(*) 
from  
(select matchid  from goal) a 
left join 
(select id, stadium from game) b 
on a.matchid = b.id 
group by b.stadium; 

每一場波蘭'POL'有參與的賽事中，列出賽事編號 matchid, 日期date 和入球數字。
select b.matchid, a.mdate, count(*) 
from  
(select id, mdate from game where team1 = 'POL' or team2 = 'POL') a 
join (select matchid from goal) b 
on a.id = b. matchid 
group by b.matchid; 

每一場德國'GER'有參與的賽事中，列出賽事編號 matchid, 日期date 和德國的入球數字。
select b.id, b.mdate, count(a.gtime) 
from 
(select matchid, gtime from goal where teamid = 'GER') a 
right join 
(select id, mdate from game where team1 = 'GER' or team2 = 'GER') b 
on a.matchid = b.id 
group by b.id;

List every match with the goals scored by each team as shown. This will use "CASE WHEN" which has not been explained in any previous exercises.
select 
   b.mdate, 
   b.team1, 
   sum(case when teamid=team1 then 1 else 0 end) as score1, 
   b.team2, 
   sum(case when teamid=team2 then 1 else 0 end) as score2 

from 
(select matchid, teamid from goal) a 
right join 
(select id ,mdate, team1, team2 from game) b 
on a.matchid = b.id 

group by b.mdate, b.team1, b.team2 
order by b.mdate, a.matchid, b.team1, b.team2;

PART - 3

「先进入上面的链接自己做，再参考下面的答案」

「movie電影」id編號, title電影名稱, yr首影年份, director導演, budget製作費, gross票房收入

「actor演員」id編號, name姓名

「casting角色」movieid電影編號, actorid演員編號, ord角色次序

「角色次序代表」第1主角是1, 第2主角是2...如此類推

列出電影北非諜影 'Casablanca'的演員名單。使用 movieid=11768, 這是你上一題得到的結果。
select b.name 
from  
(select actorid from casting where movieid = 11768) a  
left join 
(select id, name from actor) b 
on a.actorid = b.id; 

顯示電影異型'Alien' 的演員清單。
select c.name 
from 
(select id from movie where title = 'Alien') a 
left join 
(select movieid, actorid from casting) b 
on a.id = b.movieid 
left join 
(select id, name from actor) c 
on b.actorid = c.id; 

列出演員夏里遜福 'Harrison Ford' 曾演出的電影。
select c.title 
from  
(select id from actor where name = 'Harrison Ford') a 
left join 
(select movieid, actorid from casting) b 
on a.id = b.actorid 
left join  
(select id, title from movie) c  
on b.movieid = c.id; 

列出演員夏里遜福 'Harrison Ford' 曾演出的電影，但他不是第1主角。
select c.title 
from  
(select id from actor where name = 'Harrison Ford') a 
left join 
(select movieid, actorid, ord from casting) b 
on a.id = b.actorid 
left join  
(select id, title from movie) c  
on b.movieid = c.id 
where b.ord != 1; 

列出1962年首影的電影及它的第1主角。
select a.title, c.name 
from  
(select id, title from movie where yr = 1962) a  
inner join  
(select movieid, actorid, ord from casting where ord = 1) b 
on a.id = b.movieid 
left join 
(select id, name from actor) c 
on b.actorid = c.id; 

或者

select a.title, c.name 
from  
(select id, title from movie where yr = 1962) a  
left join  
(select movieid, actorid, ord from casting) b 
on a.id = b.movieid 
left join 
(select id, name from actor) c 
on b.actorid = c.id 
where b.ord = 1; 

尊·特拉華達'John Travolta'最忙是哪一年? 顯示年份和該年的電影數目。
select yr, count(*) as movie_num
from  
(select movieid from casting where actorid = (select id from actor where name = 'John Travolta')) a 
left join 
(select id, yr from movie) b 
on a.movieid = b.id 
group by yr 
order by movie_num DESC 
limit 1; 

列出演員茱莉·安德絲'Julie Andrews'曾參與的電影名稱及其第1主角。
select c.title, d.name 
from  
(select distinct movieid from casting where actorid = (select id from actor where name = 'Julie Andrews')) a  
left join  
(select movieid, actorid from casting where ord = 1) b 
on a.movieid = b.movieid  
left join 
(select id, title from movie) c 
on a.movieid = c.id  
left join 
(select id, name from actor) d 
on b.actorid = d.id; 

列出按字母順序，列出哪一演員曾作30次第1主角。
select b.name 
from  
(select actorid from casting where ord = 1 group by actorid having count(movieid) >= 30) a 
left join  
(select id, name from actor) b 
on a.actorid = b.id 
order by b.name; 

列出1978年首影的電影名稱及角色數目，按此數目由多至少排列。
select a.title, count(b.ord) as ord_num 
from  
(select id, title from movie where yr = 1978) a  
inner join  
(select movieid, ord from casting) b 
on a.id = b.movieid 
group by a.title 
order by ord_num DESC; 

列出曾與演員亞特·葛芬柯'Art Garfunkel'合作過的演員姓名。
select b.name 
from  
(select distinct actorid  from casting where movieid in (select movieid  from casting  where actorid = (select id from actor where name = 'Art Garfunkel')) and  actorid != (select id from actor where name = 'Art Garfunkel')) a 
left join  
(select id, name from actor) b 
on a.actorid = b.id; 

或者

select b.name 
from 
(select distinct actorid from casting where movieid in (select movieid from casting where actorid = (select id from actor where name = 'Art Garfunkel'))) a 
left join 
(select id, name from actor) b 
on a.actorid = b.id 
where b.name != 'Art Garfunkel';

点赞，留言。可以获取更多我整理的一些 SQL 面试题 : )

最后，一如既往的，附上我的数据分析大礼包：

希望投身数据浪潮的盆友，可以看这篇回答：3个月拿到数据分析offer~
数据分析师学习清单：超级菜鸟怎么学习数据分析？
转行时如何做出下一步选择：如何知道自己喜欢做什么职业？
数据分析师日常工作是什么？
SQL系列：
6000赞实战题目分享：如何学习 SQL 语言？刷题！！！
新整理的 SQL 面试题：面试数据分析会遇到的SQL题~不定时更新~
PYTHON系列：
做到这些就可以精通Python：编程零基础应当如何开始学习 Python？
我的零基础 Python 学习经验分享：你是如何自学 Python 的？
Python入门案例：什么因素最影响房价？
数据分析实战技巧一：如何进行A/B测试
数据分析实战技巧二：假设检验入门
数据分析实战技巧三：Python 可视化

祝大家能够在大数据的浪潮里淘到金子~

5万收藏，只有1万赞~希望大家能够帮忙点赞~给我持续更新数据分析干货的动力~谢谢~
http://s.zhihu.com/B2C4r (二维码自动识别)

---

## 提取说明

无
