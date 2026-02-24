var nav_user_name =document.getElementById("nav_user_name");
var nav_user_name2 =document.getElementById("nav_user_name2");
var hasSession = localStorage.getItem("session");
var firstName = localStorage.getItem("FirstName");
var lastName = localStorage.getItem("LastName");
var logOutBtn = document.getElementById("logOutBtn");
/* dados datebla extintores */
var extintoresRowBody = document.getElementById("extintoresRowBody");
var contagemExtintores = document.getElementById("contagemExtintores");
var addExtintor = document.getElementById("addExtintor");
var tabelaExtintores = document.getElementById("extintores_table");
var add_Extintores_div = document.getElementById("add_Extintores_div");
var numSerie = document.getElementById("numeroDeSerieExtintorAdd");
var dataAdicao = document.getElementById("dataAdicaoExtintorAdd");
var dataValidade = document.getElementById("dataValidadeExtintorAdd");
var criarExtintor = document.getElementById("criarExtintor");

var dataRetieved = "";

document.addEventListener("DOMContentLoaded", async function() {
    if(hasSession == "yes"){
        nav_user_name.innerHTML = `${firstName} ${lastName}`;
        nav_user_name2.innerHTML = `${firstName} ${lastName}`
    }else{
        window.location.href = '../../../index.html';
    }

    /* API CALL EXTINTORES */
    var getExtintores ;
    const userAction = async () => {
        const response = await fetch('https://oleitech.pt/get_extintores', {
          method: 'GET',
        });

        const myJson = await response.json(); //extract JSON from the http response
     

console.log(document.getElementById("contagem-extintores"));
    document.getElementById("contagem-extintores").innerHTML += `${myJson.length}`;

        // do something with myJson
        dataRetieved = myJson;
    }
    await userAction();
    


});

