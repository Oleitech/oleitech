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
    const funcgetExtintores = async () => {
        const response = await fetch('https://oleitech.pt/get_extintores', {
          method: 'GET',
        });

        const myJson = await response.json(); //extract JSON from the http response
     
        for (let i = 0; i < myJson.length; i++) {
            extintoresRowBody.innerHTML += `<tr class="align-middle"><td>${i+1}</td><td>${myJson[i].numero_serie}</td><td><input id="input-data-adicao-${i}" value="${myJson[i].data_adicao}" type="" /></td><td><input id="input-data-validade-${i}" value="${myJson[i].data_validade}" type="" /></td> <th><button class="remove-btn" id="delete-extintor-${i}"><i class="fa-solid fa-trash-can"></i></button></th></tr>`;
        }

       


        // do something with myJson
        dataRetieved = myJson;
    }
    await funcgetExtintores();
    
    /* check if homepage of backoffice */


});

/* LogOutClick */
logOutBtn.onclick = function(){
    localStorage.clear();
    window.location.href = '/alerta-BVO/';
};

/* gravar Extintores */
addExtintor.addEventListener("click", async function() {
    tabelaExtintores.style.display = "none";
    add_Extintores_div.style.display = "flex";
    addExtintor.style.display = "none";
});




/* FUNC standby add extintor */
criarExtintor.onclick = async function(){
if(numSerie.value && dataAdicao.value && dataValidade.value){
const postExtintor = async () => {
    fetch("https://oleitech.pt/grava_extintores", {
        method: "POST",
        body: JSON.stringify({
          numero_serie: `${numSerie.value}`,
          data_adicao: `${dataAdicao.value}`,
          data_validade: `${dataValidade.value}`
        }),
        headers: {
          "Content-type": "application/json; charset=UTF-8"
        }
      });
} 
await postExtintor();
console.log(postExtintor);
Swal.fire({
    icon: "success",
    title: "Extintor Adicionado!",
    showConfirmButton: false,
    timer: 1000
  }).then(function() {
    window.location = "../lista-extintores/";
});
}else{
    Swal.fire({
        icon: "error",
        title: "Oops...",
        text: "Insira todos os dados!",
        confirmButtonColor: '#d0895d',
        iconColor: '#cb3741',
      });
}
}


/* delete extintor */
setTimeout(function() {
    for (let i = 0; i < dataRetieved.length; i++) {
var el = document.getElementById(`delete-extintor-${i}`);

el.addEventListener('click', function() {
    Swal.fire({
        title: "Tem a certeza que quer remover este Extintor?",
        text: "Isto não pode ser revertido!",
        icon: "warning",
        showCancelButton: true,
        cancelButtonColor: "#d33 !important",
      }).then((result) => {
        if (result.isConfirmed) {

    const deleteExtintor = async () => {
        const response = await fetch(`https://oleitech.pt/delete_extintor/${dataRetieved[i]["id"]}`, {
          method: 'DELETE',
        });

            window.location.reload();
     
    }
        deleteExtintor(); 
    }
});
    });
    }


    for (let i = 0; i < dataRetieved.length; i++) {
        let adicaoInput = document.getElementById(`input-data-adicao-${i}`);
        let validadeInput = document.getElementById(`input-data-validade-${i}`);

        adicaoInput.addEventListener('change', function(e) {
            const updateExtintorDataAdicao = async () => {
                const response = await fetch(`https://oleitech.pt/update_extintor_data_adicao/${dataRetieved[i]["id"]}`, {
                  method: 'PUT',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    data_adicao: `${adicaoInput.value}`,
                  }),
                });
                const data = await response.json();
            }
            updateExtintorDataAdicao();
            Swal.fire({
                icon: "success",
                title: "Extintor Removido com sucesso!",
                showConfirmButton: false,
                timer: 1000
              })
        });

        validadeInput.addEventListener('change', function(e) {
            const updateExtintorDataValidade = async () => {
                const response = await fetch(`https://oleitech.pt/update_extintor_data_validade/${dataRetieved[i]["id"]}`, {
                  method: 'PUT',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    data_validade: `${validadeInput.value}`,
                  }),
                });
                const data = await response.json();
                
           
            }
            updateExtintorDataValidade();
           
            Swal.fire({
                icon: "success",
                title: "Extintor Removido com sucesso!",
                showConfirmButton: false,
                timer: 1000
              })
        });
    }
}, 200);




