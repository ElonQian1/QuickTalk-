/* 单文件版：内置 SDK + QuickTalk 兼容层，避免二次加载被 CSP 拦截 */
(function(){
  // ====== SDK (embedded) ======
  (function(){"use strict";var __defProp=Object.defineProperty;var __getOwnPropDesc=Object.getOwnPropertyDescriptor;var __getOwnPropNames=Object.getOwnPropertyNames;var __hasOwnProp=Object.prototype.hasOwnProperty;var __export=(target,all)=>{for(var name in all)__defProp(target,name,{get:all[name],enumerable:true});};var __copyProps=(to,from,except,desc)=>{if(from&&typeof from==="object"||typeof from==="function"){for(let key of __getOwnPropNames(from))if(!__hasOwnProp.call(to,key)&&key!==except)__defProp(to,key,{get:()=>from[key],enumerable:!(desc=__getOwnPropDesc(from,key))||desc.enumerable});}return to;};var __toCommonJS=(mod)=>__copyProps(__defProp({},"__esModule",{value:true}),mod);var sdk_exports={};__export(sdk_exports,{CustomerServiceSDK:()=>CustomerServiceSDK,default:()=>CustomerServiceSDK,createCustomerServiceSDK:()=>createCustomerServiceSDK});var windowAny=typeof window!=='undefined'?window:{};class CustomerServiceSDK{constructor(config){this.ws=null;this.eventListeners=new Map;this.reconnectAttempts=0;this.reconnectTimer=null;this.isConnecting=false;this.sessionId=null;this.config={reconnectInterval:3e3,maxReconnectAttempts:5,...config};["connected","disconnected","message","typing","error","reconnecting","staffOnline","staffOffline"].forEach(e=>{this.eventListeners.set(e,[]);});}async connect(){if(this.isConnecting||this.ws&&this.ws.readyState===WebSocket.OPEN)return;this.isConnecting=true;try{const wsUrl=this.buildWebSocketUrl();this.ws=new WebSocket(wsUrl);this.ws.onopen=this.handleOpen.bind(this);this.ws.onmessage=this.handleMessage.bind(this);this.ws.onclose=this.handleClose.bind(this);this.ws.onerror=this.handleError.bind(this);}catch(error){this.isConnecting=false;this.emit("error",{type:"connection_failed",error});throw error;}}disconnect(){if(this.reconnectTimer){clearTimeout(this.reconnectTimer);this.reconnectTimer=null;}if(this.ws){this.ws.close();this.ws=null;}this.isConnecting=false;this.reconnectAttempts=0;}sendMessage(content,messageType="text",fileUrl){if(!this.ws||this.ws.readyState!==WebSocket.OPEN)throw new Error("WebSocket is not connected");const message={messageType:"send_message",content,senderType:"customer",timestamp:new Date,metadata:{messageType,fileUrl}};this.ws.send(JSON.stringify(message));}sendTyping(isTyping){if(!this.ws||this.ws.readyState!==WebSocket.OPEN)return;const message={messageType:"typing",metadata:{isTyping}};this.ws.send(JSON.stringify(message));}async getMessageHistory(limit=50,offset=0){if(!this.sessionId)throw new Error("No active session");try{const response=await fetch(`${this.config.serverUrl.replace('ws','http')}/api/sessions/${this.sessionId}/messages?limit=${limit}&offset=${offset}`,{headers:{Authorization:`Bearer ${this.config.apiKey}`}});if(!response.ok)throw new Error("Failed to fetch message history");return await response.json();}catch(error){this.emit("error",{type:"api_error",error});throw error;}}on(eventType,listener){const listeners=this.eventListeners.get(eventType)||[];listeners.push(listener);this.eventListeners.set(eventType,listeners);}off(eventType,listener){if(!listener){this.eventListeners.set(eventType,[]);return;}const listeners=this.eventListeners.get(eventType)||[];const index=listeners.indexOf(listener);if(index>-1){listeners.splice(index,1);}}isConnected(){return this.ws!==null&&this.ws.readyState===WebSocket.OPEN;}getSessionId(){return this.sessionId;}buildWebSocketUrl(){const baseUrl=this.config.serverUrl.replace(/^http/,'ws');return `${baseUrl}/ws/customer/${this.config.apiKey}/${this.config.customerId}`;}handleOpen(){var _a;this.isConnecting=false;this.reconnectAttempts=0;const authMessage={messageType:"auth",metadata:{apiKey:this.config.apiKey,customerId:this.config.customerId,customerName:this.config.customerName,customerEmail:this.config.customerEmail,customerAvatar:this.config.customerAvatar}};(_a=this.ws)==null?void 0:_a.send(JSON.stringify(authMessage));this.emit("connected");}handleMessage(event){var _a,_b,_c,_d,_e;try{const message=JSON.parse(event.data);switch(message.messageType){case"auth_success":this.sessionId=message.sessionId||null;break;case"new_message":this.emit("message",{id:(_a=message.metadata)==null?void 0:_a.id,content:message.content,messageType:((_b=message.metadata)==null?void 0:_b.messageType)||"text",senderId:message.senderId,senderType:message.senderType,timestamp:message.timestamp?new Date(message.timestamp):new Date,sessionId:message.sessionId,fileUrl:(_c=message.metadata)==null?void 0:_c.fileUrl});break;case"typing":this.emit("typing",{isTyping:(_d=message.metadata)==null?void 0:_d.isTyping,senderId:message.senderId});break;case"staff_status":if((_e=message.metadata)==null?void 0:_e.isOnline)this.emit("staffOnline",message.metadata);else this.emit("staffOffline",message.metadata);break;default:console.warn("Unknown message type:",message.messageType);}}catch(error){this.emit("error",{type:"message_parse_error",error});}}handleClose(){this.isConnecting=false;this.emit("disconnected");if(this.reconnectAttempts<this.config.maxReconnectAttempts){this.emit("reconnecting",{attempt:this.reconnectAttempts+1});this.reconnectTimer=setTimeout(()=>{this.reconnectAttempts++;this.connect().catch(()=>{});},this.config.reconnectInterval);}}handleError(error){this.isConnecting=false;this.emit("error",{type:"websocket_error",error});}emit(eventType,data){const listeners=this.eventListeners.get(eventType)||[];listeners.forEach(listener=>{try{listener(data);}catch(error){console.error(`Error in event listener for ${eventType}:`,error);}});}}function createCustomerServiceSDK(config){return new CustomerServiceSDK(config);}windowAny.CustomerServiceSDK=CustomerServiceSDK;windowAny.createCustomerServiceSDK=createCustomerServiceSDK;})();

  // ====== QuickTalk 兼容层（不再二次加载 SDK） ======
  function onReady(fn){
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
    else fn();
  }
  function createUI(){
    if (document.getElementById('qt-fab')) return { btn: document.getElementById('qt-fab'), panel: document.getElementById('qt-panel'), input: document.querySelector('#qt-panel input'), send: document.querySelector('#qt-panel button'), body: document.querySelector('#qt-panel .qt-body') };
    var btn=document.createElement('div'); btn.id='qt-fab'; btn.className='qt-fab'; btn.textContent='客服';
    // 兜底样式
    Object.assign(btn.style,{position:'fixed',right:'18px',bottom:'18px',background:'#07C160',color:'#fff',borderRadius:'999px',padding:'12px 16px',boxShadow:'0 10px 25px -12px rgba(7,193,96,.6)',cursor:'pointer',userSelect:'none',font:'600 14px/1.2 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif',zIndex:'2147483647'});
    var panel=document.createElement('div'); panel.id='qt-panel'; panel.className='qt-panel';
    Object.assign(panel.style,{position:'fixed',right:'18px',bottom:'68px',width:'320px',height:'440px',background:'#fff',borderRadius:'12px',boxShadow:'0 16px 48px -12px rgba(15,23,42,.35)',display:'none',flexDirection:'column',overflow:'hidden',zIndex:'2147483647'});
    panel.innerHTML='<div class="qt-header" style="padding:12px 14px;border-bottom:1px solid #eee;font-weight:700;background:#f9fafb">在线客服</div><div class="qt-body" style="flex:1;padding:10px 12px;overflow:auto;background:#fafafa"></div><div class="qt-input" style="display:flex;gap:8px;padding:10px;border-top:1px solid #eee;background:#fff"><input type="text" placeholder="输入消息..." style="flex:1;padding:8px 10px;border:1px solid #ddd;border-radius:8px"/><button style="padding:8px 12px;border-radius:8px;background:#2563eb;color:#fff;border:none;cursor:pointer">发送</button></div>';
    document.body.appendChild(btn); document.body.appendChild(panel);
    return { btn: btn, panel: panel, input: panel.querySelector('input'), send: panel.querySelector('button'), body: panel.querySelector('.qt-body') };
  }
  function wireUI(sdk, ui){
    var open=false; function toggle(){ open=!open; ui.panel.style.display=open?'flex':'none'; }
    ui.btn.addEventListener('click', toggle);
    function addMsg(text, own){ var item=document.createElement('div'); item.className='qt-msg'+(own?' own':''); item.textContent=text; item.style.maxWidth='78%'; item.style.margin='6px 0'; item.style.padding='8px 10px'; item.style.borderRadius='10px'; item.style.boxShadow='0 8px 24px -16px rgba(15,23,42,.25)'; if(own){ item.style.background='#2563eb'; item.style.color='#fff'; item.style.alignSelf='flex-end'; } ui.body.appendChild(item); ui.body.scrollTop=ui.body.scrollHeight; }
    ui.send.disabled = false;
    ui.send.addEventListener('click', function(){ var txt=(ui.input.value||'').trim(); if(!txt) return; try{ sdk.sendMessage(txt,'text'); }catch(e){ console.error(e); } addMsg(txt,true); ui.input.value=''; });
    sdk.on('message', function(m){ if(m&&m.content) addMsg(m.content, m.senderType==='customer'); });
  }
  window.QuickTalkCustomerService={
    init: function(opts){
      var serverUrl=(opts&&opts.serverUrl)||(location.protocol+'//'+location.host);
      var shopRef=opts&&opts.shopId; if(!shopRef){ console.error('QuickTalk init: shopId 必填'); return; }
      onReady(function(){
        var ui=createUI();
        ui.send.disabled = true; // 等待 SDK 准备
        try {
          var sdk=new window.CustomerServiceSDK({
            serverUrl: serverUrl,
            apiKey: String(shopRef),
            customerId: 'guest-'+Math.random().toString(36).slice(2),
            reconnectInterval: 5000,
            maxReconnectAttempts: 5
          });
          wireUI(sdk, ui); sdk.connect(); console.log('QuickTalk single-file shim initialized');
        } catch (e) {
          console.error('QuickTalk 初始化失败', e);
        }
      });
    }
  };
})();
