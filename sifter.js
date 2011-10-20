/*
 * 管理路由列表
 * 负责列表的操作和url的匹配
 */

/* -- 规则表数据结构 -- */

//过滤请求的route总表
//一个请求过来,拿到url就是查这个表挨个匹配
var routeList = {
	domain: [
		//rules
	]
	
};

//支持分组
//从配置文件加载上来并处理过的分组数据结构
// groupName -> group
var ruleGroups = {};

//TODO: 加载配置的时候需要把所有条目在这里建立索引
//方便通过unid直接获取一条rule的全部信息
var rules = {
	// unid -> rule
};

//rule的数据结构
//{unid: 3, groupname: 'wpi', domain: 'wpi.renren.com', patten: '', regex: '', handler: 'handler', on: true}

/* -- 对外借口定义 -- */

//启用一个分组
//把组内的规则逐个添加到routeList中
//把配置的rewrite写到routeList中
var enableGroup = exports.enableGroup = function(gname){
	if( !ruleGroups[gname] ){
		return false;  //没这个分组
	}
	var rules = ruleGroups[gname].rules || {};

	var unid;
	for(unid in rules){  //逐个添加到routeList中
		addToRoutelist(unid);
	}
	//TODO: domain的配置 rewrite
};
//停用一个分组
//把该组规则逐个从routeList删除
//TODO: 把配置删除
var disableGroup = exports.disableGroup = function(gname){
	if( !ruleGroups[gname] ){
		return false;  //没这个分组
	}
	var rules = ruleGroups[gname].rules || {};

	var unid;
	for(unid in rules){  //逐个添加到routeList中
		delFromRoutelist(unid);
	}
};
//启用一条规则
var enableRule = exports.enableRule = function(unid){
	//只是简单的更改rule里的enabled字段
	if(unid in rules){
		rules[unid].on = true;
	}
};
//停用一条规则
var disableRule = exports.disableRule = function(){
	if(unid in rules){
		rules[unid].on = false;
	}
};
//添加一条规则
//先取个号 unid
//添加到分组,
//如果分组正启用状态,添加到routeList
var addRule = exports.addRule = function(gname, record){
	if( !ruleGroups[gname] ){
		return false;  //没这个分组
	}
	var group = ruleGroups[gname];
	//组装这个rule
	var rule = {
		groupname: gname,
		domain: record.domain,
		patten: record.patten,
		handler: record.handler,
		on: true  //默认是启用状态
	};

	//取个号,添加到group中
	var unid = getUnid(rule);
	if(!group.rules) group.rules = {};
	group.rules[unid] = rule;

	//如果分组正启用,添加到routeList
	if(group.enabled){
		addToRoutelist(unid);
	}
};
//删除一条规则
//从routeList删除,从对应分组删除
var delRule = exports.delRule = function(unid){
	if(!rules[unid]) return false;
	var rule = rules[unid];
	var group = ruleGroups[rule.groupname];

	//如果分组正启用
	if(group.enabled){
		delFromRoutelist(unid);
	}
	//从分组中删除
	delete group.rules[unid];
};
//获取分组列表(包括启用状态)
var listGroups = exports.listGroups = function(){
	var list = {};
	for(var gname in ruleGroups){
		list[gname] = ruleGroups[gname].enabled;
	}
	return list;
};


/*  辅助函数 */

//rule的 运行时唯一ID
//把rule添加到rules列表中,返回unid
var unid = 0;
function getUnid(rule){
	var i = ++unid;
	rule.unid = i;
	//TODO: 没有*通配符的优化
	rule.regex = buildRegex(rule.patten),
	rules[i] = rule;
	return i;
}
//从通配符的patten生成可以匹配的正则对象
//exp: /webpager/*
function buildRegex(patten){
	var schar = ['.', '?'];
	schar.forEach(function(char){
		patten = patten.replace(new RegExp('\\'+ char, 'g'), '\\'+char)
	});

	var regex = new RegExp( patten.replace(/\*/g, '\.*') +'$' );
	return regex;
}
exports.buildRegex = buildRegex;
// ----- routeList操作相关
//不管是不是已经有,取到域名
function getDomainRules(domain){
	if(!routeList[domain]){
		routeList[domain] = [];
	}

	return routeList[domain];
}
//设置一个域名的配置
function setDomainParam(domain, key, value){
	var rules = getDomainRules(domain);
	rules[key] = value;
}
//把一条记录添加到routeList指定域下
//通过参数unid从rules列表中取rule的数据结构
function addToRoutelist(unid){
	var rule = rules[unid];
	var domain = rule.domain.split(',');  //如果是多域名的配置
	domain.forEach(function(d){
		var rules = getDomainRules(d);
		rules.unshift(rule);  //添加到队列的头部
	});
}
//从routeList中删除unid的记录
//依赖rules索引列表
//从rules中查到rule
function delFromRoutelist(unid){
	var rule = rules[unid];
	var domain = rule.domain.split(',');  //如果是多域名的配置

	//逐个domain的处理
	domain.forEach(function(d){
		var rules = getDomainRules(d);
		for(var i; i<rules.length; i++){
			if(rules[i].unid == unid){
				rules.splice(i, 1);  //逐个查找,找到了就删除这个元素
				return; //然后结束for循环
			}
		}
	});
}

//遍历一个分组内的所有规则
//传入参数为  domain groupName unid rule{}
//function forEachRule(group, fun){
//}




//启用一个分组的规则
exports.enable = function(group){
	//*是个暗号,启用所有分组
	if(group == '*'){
		for(i in groups){
			arguments.callee(i);
		} 
		return;
	}

	if( !(group in groups) ){
		console.log('<ERROR>: No group Named '+ group);
		return;
	}
	//避免重复启用
	if(groups[group].isEnabled) return;

	var conflict = [];
	//遍历这个分组所有的规则,添加到路由表中
	groups[group].forEach(function(v,i){
		var code = enableRule(v);
		//如果冲突的话,记录这次冲突
		if(code == -1){
			conflict.push(v);
		}
	});

	//完成操作
	groups[group].isEnabled = true;  //标示这个分组已经启用
	console.log('Enabled Group: '+ group);
	if(conflict.length){
		console.log('<Conflict>: ', conflict);
	}
};

//停用一个分组的规则
exports.disable = function(group){
	// *是个暗号,停用所有分组
	if(group == '*'){
		exports.exact = {};
		exports.sections = {};
		for(i in groups){
			groups[i].isEnabled = false;
		} 
		return;
	}
	//避免重复操作
	if(!groups[group].isEnabled) return;

	if( !(group in groups) ){
		console.log('<ERROR>: No group Named '+ group);
		return;
	}
	//遍历这个分组,逐条delete
	groups[group].forEach(function(v,i){
		var code = disableRule(v);
	});

	//完成操作
	groups[group].isEnabled = false;  //标示这个分组已经停用
	console.log('Disabled Group: '+ group);
};
//}}}

//把一个规则插入指定的map中
//判断是否有,值是否相同
//@param map{object} 把键值对插入这个map
//@param key{string} 
//@param value{array} 只能用0和1两个格子,第三个格子放置引用计数
//@param target{obj} {exact:{}, sections:{}}可以不是全局的那个exact和sections  暂时不用
function enableRule(rule, target){
	var code = 0; //0:只有这一条 1:计数+1 -1:冲突
	var a = splitRule(rule, target);
	var map = a.map,
		key = a.key,
		array = a.array;

	//判断是否有这个key
	if(key in map){
		if( isSameHandler(map[key], array) ){  //如果有,值是否相同
			map[key][2]++;  //计数+1
			code = 1;
		}else{
			//TODO: 有冲突,目前方案,直接覆盖,并给用户显示提示
			map[key] = array.slice(0).concat( ++map[key][2] );
			code = -1;
		}
	}else{  //没有这个key,直接set进去
		map[key] = array.slice(0);
		map[key][2] = 1;
	}
	return code;
}

//跟上面对应的,删除一个规则
function disableRule(rule){
	var code = 1;  //0:删除了这条 1:计数-1
	var a = splitRule(rule);
	var map = a.map,
		key = a.key;

	//判断是否有这个key
	if( !(key in map) ){
		return -1;
	}
	if( --map[key][2] <= 0 ){  //如果计数归零了
		delete map[key];  //删除这个属性
		return 0;
	}
	return 1;
}

//识别一条rule的类型
//设计想法: 把rule的操作抽象成 key和array的比较
//map是被操作的那个object, key是需要操作的那个键
//array统一只用0和1两个格子
function splitRule(rule, obj){
	var router = obj || exports;  //这个router可以是指定的一个空的{exact: {}, sections: {}}
	if(rule.scope == '*'){  //全局的全路径匹配
		map = router.exact;
		key = rule.location;
		array = rule.handler;
	}else{  //特定域名的设置
		var domain = rule.scope;
		var section = router.sections[domain];
		if( !section ){ section = router.sections[domain] = {}; }
		if( rule.setting ){ //首先判断是否特殊属性 setting
			map = section;
			key = rule.setting;
			array = rule.handler;
		}else{  //普通location的handler
			map = section.location;
			if(!map) map = section.location = {};
			key = rule.location;
			array = rule.handler;
		}
	}
	
	return {
		map: map,
		key: key,
		array: array
	};
}
//判断两个array的前两个元素是否相同
//同样适用rewrite
//return true/false;
function isSameHandler(a, b){
	if(a[0] == b[0] && a[1] == b[1]){
		return true;
	}
	return false;
}

//向配置中添加一条规则
//如果有重复,直接覆盖,相当于edit
//return 0:新加了一条 1:编辑了一条
exports.addRule = function(group, rule){
	var g = groups[group];
	var i = findRule(g, rule);
	var edit = 0;  //enableRule是否编辑模式调用
	if( i<0 ){  //这是个新的rule
		g.push(rule);
	}else{  //要编辑现有的rule
		g.splice(i,1, rule);
		edit = 1;
	}
	//如果这个分组是启用状态,得通知用户"原有设置已经被覆盖"
	if(g.isEnabled){
		enableRule(rule, edit);
	}
	return edit;
};

//从配置中添删除一条规则
//return -1(没有这个条目) 0正常删除了
exports.delRule = function(group, rule){
	var g = groups[group];
	var i = findRule(g, rule);
	if( i<0 ){
		return -1;
	}
	//如果这个分组刚好启用呢,禁用这个规则
	if( g.isEnabled ) disableRule( g[i] );

	g.splice(i, 1);  //从该组删除
	return 0;
};

//查看一个分组是否是启用状态
function isEnabled(group){
	return groups[group].isEnabled;
}

//找到跟rule匹配的设置
//只做比较,找到相同的那个规则,返回序号
function findRule(g, rule){
	var x = -1;
	//又是遍历,找到那一条
	for(var i=0; i<g.length; i++){
		if(g[i].domain == rule.domain){
			if( rule.rewrite && g[i].rewrite == rule.rewrite ){
				x = i;
				break;
			}else if( rule.location && g[i].location == rule.location){
				x = i;
				break;
			}
		}
	}
	return x;
}

var fs = require('fs');
var path = require('path');
//保存一个分组
var dir_base = __dirname;  //程序根目录
var dir_conf = path.join(dir_base, '/conf');
var dir_rule = path.join(dir_conf, '/rule');

//保存一个分组的规则到相应的文件
function saveGroup(group){
	var rules = groups[group];
	//if( !rules.isModified ) return 0; //没有修改过的话不需要保存
	//覆盖写入
	var fpath = path.join(dir_rule, group +'.rule');
	rules = JSON.stringify(rules, '', '\t'); //这里\t格式话输出的JSON
	fs.writeFileSync( fpath, rules, 'utf8');
}

//只负责加载指定的配置到groups中
//完全同步的函数
//@param filename{str} 带扩展名的文件名字符串
function loadGroup(filename){
	var fpath = path.join( dir_rule , filename);
	var content = fs.readFileSync(fpath, 'utf8');
	var routeList = null;
	try{
		routeList = JSON.parse(content);
	}catch(e){
		console.error('配置文件JSON解析出错: ', content);
		return -1;
	}
	
	var group = path.basename(filename, '.rule');
	if(routeList){
		groups[group] = routeList;
	}
}
//把指定分组保存到磁盘
exports.save = function(group){
	if(!group || group == '*'){  //保存所有分组
		for(var i in groups){
			saveGroup(i);
		}
		return;
	}
	if( !(group in groups)) return;
	saveGroup(group);
};

//重新加载一个分组文件的规则列表
var reload = exports.reload = function(filename){
	var group = path.basename(filename, '.rule');
	//停用分组
	var e = groups[group].isEnabled;
	exports.disable(group);
	//加载
	loadGroup( group +'.rule' );
	//重新启用分组
	if(e) exports.enable(group);
};

//初始化此模块时处理文件系统上的配置
//(function(){
//	var rs = fs.readdirSync(dir_rule);
//	rs.forEach(function(r,i){
//		if( ! /\.rule$/.test(r) ) return;  //扩展名必须是rule的文件才是配置文件
//		loadGroup(r);
//		var fpath = path.join(dir_rule, r);
//		//监视这个文件
//		if(process.platform.toLowerCase() != 'win32'){  //TODO: 目前windows版本的nodejs还不支持这个功能
//			fs.watchFile(fpath, function(curr, prev){
//				//console.info(curr, prev);
//				if( Number(curr.mtime) == Number(prev.mtime) ) return;  //没有被modified,不用处理
//				//---^ 这个Number将Date转换成整数来比较, 要不然两个object总是不相等
//				reload(r);
//			});
//		}
//	});
//
//	//读取配置信息,启用相应的分组
//	var file_conf = path.join(dir_conf, '/dproxy.conf');
//	var conf = fs.readFileSync( file_conf , 'utf8');
//	conf = JSON.parse(conf);
//	conf.enabledGroups.forEach(function(v,i){
//		exports.enable(v);
//	});
//
//	//程序退出的时候保存groups的启用状态
//	process.on('exit', function(){
//		exports.save();
//		var usedGroups = [];
//		for(var i in groups){
//			if(groups[i].isEnabled) usedGroups.push(i);
//		}
//		conf.enabledGroups = usedGroups;
//		fs.writeFileSync(file_conf, JSON.stringify(conf), 'utf8');
//	});
//})();

//重写以后的初始化程序
	var gHandlers = {
		'jicheng-static': {
			method: 'remote',
			targetIP: '10.2.16.123'
		},
		'chuanye-static': {
			method: 'remote',
			targetIP: '10.2.74.111'
		}
	};
(function(){
	//从磁盘上加载分组配置

	var webpager = {
		enabled: true,
		handlers: {
			'huihua-static': {
				method: 'remote',
				targetIP: '10.2.74.'
			}
		},
		rules: [
			{groupname: 'webpager', domain: 's.xnimg.cn,a.xnimg.cn', patten: '/jspro/xn.app.webpager.js', handler: 'jicheng-static'},
			{groupname: 'webpager', domain: 's.xnimg.cn', patten: '/jspro/pager-channel6.js', handler: 'jicheng-static'}
		]
	};

	var xnimg = {
		enabled: true,
		settings: {
			'xnimg.cn,s.xnimg.cn,a.xnimg.cn': {
				rewrite: ["^\/[ab]?([0-9]+)\/(.*)", "/$2" ,1]
			}
		}
	};

	var wpi = {
		enabled: true,
		handlers: {
			'ime-file': {
				method: 'local',
				file: '/Users/Lijicheng/htdocs/ime.htm'
			}
		},
		rules: [
			{groupname: 'wpi', domain: 'wpi.renren.com', patten: '/wtalk/ime.htm?v=5', handler: 'ime-file'}
		]
	};

//开始从配置数据初始化列表

var groups = {};
groups['webpager'] = webpager;
groups['xnimg'] = xnimg;
groups['wpi'] = wpi;

//遍历每个分组完成初始化
var g;
for(g in groups){
	var records = groups[g].rules;
	groups[g].rules = {};
	if(records){  //如果有这些项目
		records.forEach(function(rule){
			var id = getUnid(rule);
			groups[g].rules[id] = rule;
		});
	}
	ruleGroups[g] = groups[g];

	if(groups[g].enabled){
		enableGroup(g);
	}
}

exports.routeList = routeList;
exports.rules = rules;
})();


/*
 * 分发url
 * 如果没有匹配的规则,返回false
 * 找到匹配的规则,返回对应的handler数据
 * 参数,只关心url
 */
var URL = require('url');
exports.check = function(url){
	var url = URL.parse(url);
	var uri = url.href.replace(/http\:\/\/[^\/]+/,'');

	//查找host是否存在于routeList中
	if(!(url.host in routeList)) return false;

	//挨个匹配host中的规则
	var handler = false,
		r, g;
	var rules = routeList[url.host];
	for(var i=0; i<rules.length; i++){
		if( rules[i].regex.test(uri) ){
			r = rules[i];
			g = ruleGroups[r.groupname];
			if( r.handler in g.handlers ){  //是否在分组的handler里
				handler = g.handlers[ r.handler ];
			}else{
				handler = gHandlers[ r.handler ];
			}
			break;
		}
	}
	if( !handler ) return false; //没找到,返回false

	//如果匹配成功,找到对应的handler数据,并返回
	return handler;

	/*
	 * 最终传递给handler的vector结构
	 *
	 * {
	 *  	uri: ,
	 *  	path: ,
	 *  	handler: 'handler类型的名字',
	 *  	argument: '传递给handler的参数',
	 *  	pipe: '输出管道'
	 * }
	 */
};

//实现nginx类似的rewrite
function rewrite(uri, rule){

	var rs = uri.match( rule[0] );
	if(rs){
		uri = rule[1].replace(/\$\d/g, function(n){
			return rs[ n[1] ];  //n是$2类似的字符串
		});
	}

	return uri;
}
