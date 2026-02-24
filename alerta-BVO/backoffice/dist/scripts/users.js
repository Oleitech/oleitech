var utilizadoresRowBody = document.getElementById("utilizadoresRowBody");
var dataRetievedusers = "";
var hasSession = localStorage.getItem("session");
var firstName = localStorage.getItem("FirstName");
var lastName = localStorage.getItem("LastName");
var addUtilizador = document.getElementById("addUtilizador");
var tabelaUtilizadores = document.getElementById("utilizadores_table");
var add_Utilizadores_div = document.getElementById("add_Utilizadores_div");
var criarUtilizador = document.getElementById("criarUtilizador");
var emailAddUtilizador = document.getElementById("emailAddUtilizador");
var passAddUtilizador = document.getElementById("passAddUtilizador");
var firstNameAddUtilizador = document.getElementById("firstNameAddUtilizador");
var lastNameAddUtilizador = document.getElementById("lastNameAddUtilizador");

document.addEventListener("DOMContentLoaded", async function() {
    if(hasSession == "yes"){
        nav_user_name.innerHTML = `${firstName} ${lastName}`;
        nav_user_name2.innerHTML = `${firstName} ${lastName}`
    }else{
        window.location.href = '../../../index.html';
    }
    
    /* API CALL UTILIZADORES */
    var getExtintores ;
    const funcgetUsers = async () => {
        const response = await fetch('https://oleitech.pt/usersBVO', {
          method: 'GET',
        });
        const myJson = await response.json(); //extract JSON from the http response
        for (let i = 0; i < myJson.length; i++) {
            utilizadoresRowBody.innerHTML += `<tr class="align-middle"><td>${i+1}</td><td>${myJson[i].email}</td><td>${myJson[i].primeiro_nome}</td><td>${myJson[i].ultimo_nome}</td> <th><button class="remove-btn" id="delete-utilizador-${i}"><i class="fa-solid fa-trash-can"></i></button></th></tr>`;
    }
        // do something with myJson
        dataRetievedusers = myJson;
    }
    await funcgetUsers();
});


/* delete extintor */
setTimeout(function() {
    for (let i = 0; i < dataRetievedusers.length; i++) {
var el = document.getElementById(`delete-utilizador-${i}`);

el.addEventListener('click', function() {
    Swal.fire({
        title: "Tem a certeza que quer remover este utilizador?",
        text: "Isto não pode ser revertido!",
        icon: "warning",
        showCancelButton: true,
        cancelButtonColor: "#d33 !important",
      }).then((result) => {
        if (result.isConfirmed) {
  
   
    const deleteExtintor = async () => {
        const response = await fetch(`https://oleitech.pt/delete_utilizador/${dataRetievedusers[i]["id"]}`, {
          method: 'DELETE',
        });
        Swal.fire({
            icon: "success",
            title: "Utilizador Removido com sucesso!",
            showConfirmButton: false,
            timer: 1000
          }).then(function() {
            window.location.reload();
        });
    }
     deleteExtintor(); 
    }
});
});

    }
}, 200);


/* gravar Extintores */
addUtilizador.addEventListener("click", async function() {
    tabelaUtilizadores.style.display = "none";
    add_Utilizadores_div.style.display = "flex";
    addUtilizador.style.display = "none";
});


/* FUNC standby add extintor */
criarUtilizador.onclick = async function(){
    if(emailAddUtilizador.value && passAddUtilizador.value && firstNameAddUtilizador.value && lastNameAddUtilizador.value){
    const postUtilizador = async () => {
        fetch("https://oleitech.pt/grava_utilizadores", {
            method: "POST",
            body: JSON.stringify({
              email: `${emailAddUtilizador.value}`,
              password: `${passAddUtilizador.value}`,
              primeiro_nome: `${firstNameAddUtilizador.value}`,
              ultimo_nome : `${lastNameAddUtilizador.value}`
            }),
            headers: {
              "Content-type": "application/json; charset=UTF-8"
            }
          });
    } 
    await postUtilizador();
    Swal.fire({
        icon: "success",
        title: "Extintor Adicionado!",
        showConfirmButton: false,
        timer: 1000
      }).then(function() {
        window.location.reload();
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
