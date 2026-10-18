// Native buttons with the single-tab-stop keyboard behavior of a radio group.
export function createDurationButtons(group,initial,onChange){
 const buttons=[...group.querySelectorAll('button[data-value]')];
 let selected=buttons.find(button=>Number(button.dataset.value)===initial)||buttons[0],disabled=false;
 function paint(){for(const button of buttons){const active=button===selected;button.setAttribute('aria-checked',String(active));button.tabIndex=active?0:-1;button.disabled=disabled}}
 function choose(button,focus=false){if(disabled||button.disabled)return;selected=button;paint();if(focus)button.focus();onChange(Number(button.dataset.value))}
 for(const button of buttons){button.addEventListener('click',()=>choose(button));button.addEventListener('keydown',event=>{let index=buttons.indexOf(button);if(event.key==='ArrowRight'||event.key==='ArrowDown')index=(index+1)%buttons.length;else if(event.key==='ArrowLeft'||event.key==='ArrowUp')index=(index+buttons.length-1)%buttons.length;else if(event.key==='Home')index=0;else if(event.key==='End')index=buttons.length-1;else return;event.preventDefault();choose(buttons[index],true)})}
 paint();return {setDisabled(value){disabled=!!value;group.setAttribute('aria-disabled',String(disabled));paint()}};
}
