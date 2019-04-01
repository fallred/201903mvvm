// 观察者 （发布订阅）观察者 被观察者
class Dep {
    constructor(){
        // 存放所有的watcher
        this.subs = [];
    }
    // 添加watcher
    addSub(watcher){
        this.subs.push(watcher);
    }
    // 发布
    notify() {
        this.subs.forEach(watcher=>watcher.update());
    }
}
class Watcher {
    constructor(vm,expr,cb){
        this.vm = vm;
        this.expr = expr;
        this.cb = cb;
        // 默认存放一个老值
        this.oldValue = this.get();
    }
    get() {
        // 先把自己放在this上
        Dep.target = this;
        // 取值，把这个观察者和数据关联起来
        let value = CompileUtil.getVal(this.vm,this.expr);
        // 不清空，则会重复获取
        Dep.target = null;
        return value;
    }
    update(){
        // 更新操作 数据变化后 会调用观察者的update方法
        let newVal =  CompileUtil.getVal(this.vm,this.expr);
        if (newVal !== this.oldValue) {
            this.cb(newVal);
        }
    }
}
// vm.$watch(vm, 'school.name', (newVal)=>{

// })

// 实现数据劫持
class Observer {
    constructor(data){
        this.observer(data);
    }
    observer(data){
        if (data && typeof data == 'object') {
            for (let key in data) {
                this.defineReactive(data, key, data[key]);
            }
        }
    }
    defineReactive(obj, key, value){
        this.observer(value);
        // 给每一个属性，都加上一个具有发布订阅的功能
        let dep = new Dep();
        Object.defineProperty(obj, key, {
            get(){
                // 创建watcher时，会取到对应的内容，并且把watcher放到了全局上
                Dep.target && dep.addSub(Dep.target);
                return value;
            },
            set: (newVal)=>{ // {school:{name: '珠峰'}} school= {}
                if (newVal != value) {
                    this.observer(newVal);
                    value = newVal;
                    dep.notify();
                }
            }
        });
    }
}
// 基类 调度
class Compiler {
    constructor(el, vm){
        // 判断el属性是不是一个元素，如果不是元素，那就获取他
        this.el = this.isElementNode(el) ? el : document.querySelector(el);
        // console.log('this.el:',this.el);
        this.vm = vm;
        // 把当前节点中的元素获取到，放到内存中
        let fragment = this.node2fragment(this.el);
        // console.log('fragment:',fragment);
        
        // 把节点中的内容进行替换
        // 用数据编译模板
        this.compile(fragment);
        //把内容再塞回到页面中

        this.el.appendChild(fragment);
    }
    // 是否是指令
    isDirective(attrName){
        return attrName.startsWith('v-');
    }
    // 编译元素的
    compileElement(node){ // v-model v-html v-for
        let attributes = node.attributes;
        console.log('attributes=>',attributes);
        // console.log('attributes:',attributes);
        [...attributes].forEach(attr=>{
            // console.log('attr=>',attr);
            let {name,value:expr} = attr;
            console.log('name,value=>',name,expr);
            if (this.isDirective(name)) {
                let [,directive] = name.split('-');//v-on:click
                let [directiveName, eventName] = directive.split(':');
                CompileUtil[directiveName](node,expr,this.vm, eventName);
                console.log(node);
            }
        });
    }
    // 编译文本
    compileText(node){
        // 判断当前文本节点中的内容是否包含{{}}
        let content = node.textContent;
        // console.log('content:',content);
        if(/\{\{(.+?)\}\}/.test(content)) {
            // console.log('reg test:',content);
            CompileUtil['text'](node, content, this.vm); // {{a}} {{b}}
        }
    }
    // 核心的编译方法
    compile(node){ // 用来编译内存中的dom节点
        let childNodes = node.childNodes;
        // console.log('childNodes:',childNodes);
        [...childNodes].forEach(child=>{
            if (this.isElementNode(child)) {
                // console.log('element:', child);
                this.compileElement(child);
                // 如果是元素的话，需要把自己传进去，再去遍历子节点。
                this.compile(child);
            } else {
                this.compileText(child);
                // console.log('text:', child);
            }
        });
    }
    // 把节点移动到内存中
    node2fragment(node){
        // 创建一个文档碎片
        let fragment = document.createDocumentFragment();
        let firstChild;
        while(firstChild = node.firstChild) {
            // console.log(firstChild);
            // appendChild具有移动性
            fragment.appendChild(firstChild);
        }
        return fragment;
    }
    isElementNode(node){// 是不是元素节点
        return node.nodeType === 1;
    }
}
CompileUtil = {
    // 根据表达式取到对应数据
    getVal(vm, expr){
        // vm.$data  'school.name'
        let arr = expr.split('.');
        // if (arr.length == 1) {
        //     return vm.$data[expr];
        // }
        return arr.reduce((data, current)=>{
            console.log('reduce->data:',data);
            console.log('reduce->current:',current);
            return data[current];
        }, vm.$data);
    },
    setValue(vm,expr,value){// vm school.name 姜文
        expr.split('.').reduce((data,current,index,arr)=>{
            if (index == arr.length - 1) {
                return data[current] = value;
            }
            return data[current]
        }, vm.$data);
    },
    model(node,expr,vm){
        /*node 节点
        expr 表达式
        vm 当前实例
        school.name vm.$data
        给输入框赋予value属性 node。value=xxx
        */
        let fn = this.updater['modelUpdater'];
        new Watcher(vm, expr,(newVal)=>{
            //给输入框加一个观察者，如果稍后数据更新了，会触发此方法，
            // 会拿新值给输入框赋值
            fn(node, newVal);
        });
        node.addEventListener('input',(e)=>{
            // 获取用户输入的内容
            let value = e.target.value;
            this.setValue(vm,expr,value);
        });
        let value = this.getVal(vm,expr);
        fn(node,value);
    },
    html(node, expr, vm){ // v-html="message"
        // node.innerHTML = xxx
        let fn = this.updater['htmlUpdater']
        new Watcher(vm, expr,(newVal)=>{
            fn(node, newVal);
        });
        let value = this.getVal(vm,expr);
        fn(node,value);
    },
    getContentValue(vm, expr){
        // 遍历表达式，将内容重新替换成一个完整的内容反还回去
        return expr.replace(/\{\{(.+?)\}\}/g, (...args)=>{
            return this.getVal(vm,args[1]);
        });
    },
    on(node,expr,vm,eventName){
        node.addEventListener(eventName,(e)=>{
            // this.change()
            vm[expr].call(vm, e);
        })
    },
    text(node,expr,vm){
        let fn = this.updater['textUpdater']
        let content = expr.replace(/\{\{(.+?)\}\}/g, (...args)=>{
            // 给表达式每个人{{}}都加上观察者
            new Watcher(vm, args[1], ()=>{
                // 返回一个全的字符串
                fn(node, this.getContentValue(vm,expr));
            });
            return this.getVal(vm, args[1]);
        });
        fn(node,content)
    },
    updater: {
        // 把数据插入到节点中
        modelUpdater(node, value){
            node.value = value;
        },
        htmlUpdater(node, value){// xss攻击
            node.innerHTML = value;
        },
        textUpdater(node,value){
            node.textContent = value;
        }
    }
};
class Vue {
    constructor(options){
        this.$el = options.el;
        this.$data = options.data;
        let computed = options.computed;
        let methods = options.methods;
        if (this.$el) {
            // 把数据 全部转化成用Object.defineProperty来定义
            new Observer(this.$data);
            // 把数据获取操作，vm上的取值操作 都代理到vm.$data
            console.log('this.$data:',this.$data);

            // {{getNewName}} reduce vm.$data.getNewName
            // 有依赖关系 数据
            // 先把computed方法代理到vm.$data上，然后再将vm.$data的方法代理到代理到vm上
            for (let key in computed) {
                Object.defineProperty(this.$data, key, {
                    get:()=>{
                        return computed[key].call(this)
                    }
                });
            }
            for (let key in methods) {
                Object.defineProperty(this,key, {
                    get(){
                        return methods[key];
                    }
                });
            }
            this.proxyVm(this.$data);
            new Compiler(this.$el,this);
        }
    }
    proxyVm(data){
        for (let key in data) {
            Object.defineProperty(this,key,{ //实现了可以通过vm取到对应的内容
                get(){
                    return data[key];// 进行了转化操作
                },
                set(newVal){ //设置代理方法
                    data[key] = newVal;
                }
            });
        }
    }
}